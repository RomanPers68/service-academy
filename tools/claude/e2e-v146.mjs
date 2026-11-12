// e2e v146 (Доп. 467): «Давай все» — главная кнопка золотом, меньше колец, цвет и подписи треков, фото урока и первая мысль
// крупно, новый значок на весь экран. Сайт — демо целиком (tools/claude/demo-app/build.mjs: сервер в странице, люди демо).
// Разделы: HOME (корешок «Начать» золотом, инструменты — линзы, как были, с одним кольцом — Доп. 468; кольцо у медальонов
// есть, у «поиска» нет; под кружками треков подписей нет — Доп. 469, имя — в title и в панели по тапу; у Бара — медь),
// NARROW (320 / 360 / 430 px: шесть кружков в ряд, не наезжают, ряд не шире экрана),
// BTN (главная кнопка «Пути мастера» и «Спасти ситуацию» в разминке — золотая заливка, тёмная надпись, без кольца),
// LESSON (Анна: «Концепция и история» — фото сети и первая мысль крупно, без фотоаппарата; урок без фото — без строки
// «Добавить»), EDIT (Мария: фотоаппарат, лист, «Новое заменит его для …», фото с телефона → у урока фото заведения, после
// перезагрузки тоже; Анна видит его; «Убрать» в два касания → снова фото сети; урок без фото — «Добавить фото к уроку»),
// OWNER (Роман: «Вся сеть» и «Два моря, Океан»), MOMENT (при входе — плашка; после разминки новая ступень — момент на весь
// экран, «Позже» закрывает; момент был минуту назад — плашка), LIGHT («Для чтения»: корешок и главная кнопка золотом, Бар — тёмная медь, лист
// светлый; инструменты — светлые линзы с одним кольцом), NOW (вид «как сейчас»: без золотого корешка, подписей треков
// нет и здесь, инструменты прежние), REDUCED (меньше движения — момент без анимации).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> E2E_SRC=<исходники> node e2e-v146.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5346, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v146";
const SRC = process.env.E2E_SRC || process.cwd();
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
const PHOTO = join(SRC, "public/menu/okean_03.jpg");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(extra).slice(0, 300) : "")); } };
const browser = await chromium.launch();

// badges: false — значки не трогаем (MOMENT, REDUCED); иначе момент и плашка значка закрываются сами, как только появятся
// (появляются через 6 с после входа и перекрыли бы касания разделов)
async function open({ w = 390, h = 844, theme = "dark", who = "anna", storage = {}, reduced = false, keep = null, badges = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: theme,
    timezoneId: "Asia/Kamchatka", reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(({ who, storage, keep }) => {
    const saved = keep ? Object.fromEntries(keep.map((k) => [k, localStorage.getItem(k)])) : {};
    localStorage.clear();
    for (const [k, v] of Object.entries(saved)) if (v !== null) localStorage.setItem(k, v);
    localStorage.setItem("__demo_who", who);
    for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, typeof v === "function" ? v() : String(v));
  }, { who, storage, keep });
  await page.goto(URL0, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1800);
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
  if (badges) await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click(); }, 150); });
  // у руководителей при входе — «Утро руководителя» в Telegram: закрыть
  await page.evaluate(() => { const b = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (b) b.click(); });
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });
// войти другим человеком в той же вкладке: демо помнит своё состояние (__demo_srv), как после перезагрузки телефона
async function relogin(page, who) {
  await page.evaluate((w) => localStorage.setItem("__demo_who", w), who);
  await page.goto(URL0, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1800);
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click(); }, 150); });
  await page.evaluate(() => { const b = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (b) b.click(); });
  await page.waitForTimeout(500);
}
const nav = async (page, s, ms = 1400) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms); };
const rgb = (hex) => { const v = hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16)); return "rgb(" + v.join(", ") + ")"; };
const closeBadge = async (page) => {
  for (let i = 0; i < 3; i++) {
    const done = await page.evaluate(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) { b.click(); return true; } return false; });
    if (!done) break; await page.waitForTimeout(500);
  }
};
// разминка целиком (занятие): первый вариант в каждой ситуации, «Дальше без этого» после промаха, «На смену» в конце
async function doWarmup(page) {
  await page.locator("[data-now-cta]").click(); await page.waitForTimeout(1500);
  for (let i = 0; i < 24; i++) {
    const r = await page.evaluate(() => {
      const vis = (b) => b && b.offsetParent && !b.disabled;
      const all = [...document.querySelectorAll("button")].filter(vis);
      const by = (re) => all.find((b) => re.test((b.innerText || "").trim()));
      const end = by(/^На смену/); if (end) { end.click(); return "end"; }
      const skip = by(/^Дальше без этого/); if (skip) { skip.click(); return "skip"; }
      const main = all.find((b) => b.classList.contains("tb-main") && !/Спасти/.test(b.innerText)); if (main) { main.click(); return "main"; }
      const opt = all.find((b) => /^tb-/.test(b.className) && !/tb-(x|tool|main)\b/.test(b.className)) || by(/^(Правда|Миф)(\s|$)/);
      if (opt) { opt.click(); return "opt"; }
      return "wait";
    });
    if (r === "end") { await page.waitForTimeout(1200); return true; }
    await page.waitForTimeout(r === "opt" ? 2800 : 1300);
  }
  return false;
}
const openConcept = async (page) => {   // «Новичок» → «Открыть» → первый урок раздела «Наш ресторан» («Концепция и история»)
  await nav(page, "roleSelect", 1200);   // главная с треками (экран «home» — список тем роли)
  await page.locator("[data-track-chip=seasonal]").click(); await page.waitForTimeout(900);
  await page.locator("[data-track-go]").click(); await page.waitForTimeout(1500);
  await page.locator("button:has-text('Начать'), [role=button]:has-text('Начать')").first().click(); await page.waitForTimeout(2200);
};
// ряд треков: кружки, «8 %», подписи (Доп. 469 — их нет), цвет трека (--tc), цитата под рядом
const rowInfo = (page) => page.evaluate(() => {
  const chips = [...document.querySelectorAll("[data-track-chip]")].map((el) => {
    const r = el.getBoundingClientRect(), pct = el.querySelector("[data-track-pct]");
    return { id: el.getAttribute("data-track-chip"), title: el.title, left: r.left, right: r.right, bottom: r.bottom, tc: getComputedStyle(el).getPropertyValue("--tc").trim(),
      pctBottom: pct ? pct.getBoundingClientRect().bottom : null };
  });
  const quote = document.querySelector("[data-tracks-quote]"); const q = quote ? quote.getBoundingClientRect() : null;
  return { chips, caps: document.querySelectorAll("[data-track-cap]").length, vw: innerWidth, docW: document.documentElement.scrollWidth, quoteTop: q ? q.top : null };
});

// ── HOME ───────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("HOME")) {
  const { ctx, page, errs } = await open();
  await closeBadge(page);
  const g = await page.evaluate(() => {
    const st = document.querySelector("[data-now-stub]"), cta = document.querySelector("[data-now-cta]");
    const tool = document.querySelector("[data-tool-disc]"), med = document.querySelector(".de-medal"), srch = document.querySelector("[data-top-search]");
    return {
      lens: document.documentElement.classList.contains("sa-lens"),
      stubBg: st ? getComputedStyle(st).backgroundImage : "", ctaColor: cta ? getComputedStyle(cta).color : "",
      toolBefore: tool ? getComputedStyle(tool, "::before").display : "", toolAfter: tool ? getComputedStyle(tool, "::after").display : "",
      // Доп. 468: инструменты — линзы, как были, с одним кольцом: стекло (::before) во весь кружок, внешнего кольца нет
      tools: [...document.querySelectorAll("[data-tool-disc]")].map((d) => { const b = getComputedStyle(d, "::before"), sv = d.querySelector("svg"), sc = sv ? getComputedStyle(sv) : null;
        return { label: d.parentElement ? d.parentElement.title : "", before: b.display, top: b.top, glass: b.backgroundColor, sh: b.boxShadow,
          after: getComputedStyle(d, "::after").display, bg: getComputedStyle(d).backgroundColor, stroke: sc ? sc.stroke : "", sw: sc ? sc.strokeWidth : "" }; }),
      medRing: med ? getComputedStyle(med, "::after").borderTopColor : "", searchRing: srch ? getComputedStyle(srch, "::after").borderTopColor : "",
      barGlass: (() => { const g = document.querySelector('[data-track-chip="bar"] [data-orb-glass]'); return g ? getComputedStyle(g).backgroundColor : ""; })(),
      barArc: (() => { const c = document.querySelector('[data-track-chip="bar"] svg circle+circle'); return c ? getComputedStyle(c).stroke : "none"; })(),
      css146: !!document.getElementById("sa-look-v146-css"),
    };
  });
  ok("HOME: вид «Линза», стили v146 подключены", g.lens && g.css146, JSON.stringify(g));
  ok("HOME: «Начать» — золотой корешок, надпись тёмная", /linear-gradient/.test(g.stubBg) && g.ctaColor === "rgb(26, 16, 8)", g.stubBg.slice(0, 80) + " " + g.ctaColor);
  ok("HOME: инструменты — линза с одним кольцом (стекло ::before есть, внешнего кольца ::after нет)", g.toolBefore === "block" && g.toolAfter === "none", g.toolBefore + "/" + g.toolAfter);
  ok("HOME: инструменты Анны — Справочник, Меню, Глоссарий, Чек-листы", g.tools.map((t) => t.label).join("|") === "Справочник|Меню|Глоссарий|Чек-листы", g.tools.map((t) => t.label).join("|"));
  ok("HOME: стекло как было — во весь кружок, ободок, свет; кружок прозрачный, кольца снаружи нет",
    g.tools.length === 4 && g.tools.every((t) => t.before === "block" && t.top === "0px" && t.glass === "rgba(200, 169, 110, 0.12)" && t.sh.includes("rgba(214, 178, 102, 0.45)")
      && t.after === "none" && t.bg === "rgba(0, 0, 0, 0)"), JSON.stringify(g.tools.map((t) => [t.top, t.glass, t.after, t.bg, t.sh.slice(0, 50)])));
  ok("HOME: значки золотом, линия 1,8, как были; отсвет снизу — цветом инструмента (Меню — зелёный, Глоссарий — фиолетовый)",
    g.tools.every((t) => t.stroke === rgb("#C8A96E") && t.sw === "1.8px") && g.tools[1].sh.includes("143, 184, 144") && g.tools[2].sh.includes("155, 143, 196") && g.tools[0].sh.includes("200, 169, 110"),
    g.tools.map((t) => t.stroke + " " + t.sw).join(" · ") + " | " + g.tools.map((t) => (t.sh.match(/rgba\([^)]*\)\s+0px\s+-9px/) || [""])[0]).join(" · "));
  ok("HOME: у медальона кольцо осталось, у «поиска» — нет", g.medRing !== "rgba(0, 0, 0, 0)" && /rgba\(0, 0, 0, 0\)|transparent/.test(g.searchRing), g.medRing + " / " + g.searchRing);
  ok("HOME: стекло Бара — медь (#D2875A2E)", g.barGlass === "rgba(210, 135, 90, 0.18)", g.barGlass);
  // Доп. 469: подписей под кружками нет; имя трека — в title, в панели по тапу и в «подробнее»
  const ri = await rowInfo(page);
  ok("HOME: под кружками треков подписей нет; имена — в title по порядку", ri.caps === 0 && ri.chips.map((c) => c.title).join("|") === "Хостес|Новичок|Ядро|Менеджер|Сервис-менеджер|Бар",
    ri.caps + " / " + ri.chips.map((c) => c.title).join("|"));
  ok("HOME: цвет трека — у Бара медь, у закрытых (Ядро) цвета нет", ri.chips[5].tc.toUpperCase() === "#D2875A" && ri.chips[2].tc === "", ri.chips.map((c) => c.id + ":" + c.tc).join(" "));
  ok("HOME: «8 %» своего трека — над цитатой, ничем не подпёрта", ri.quoteTop === null || (ri.chips[1].pctBottom !== null && ri.chips[1].pctBottom <= ri.quoteTop - 8),
    JSON.stringify({ pct: ri.chips[1].pctBottom, q: ri.quoteTop }));
  await page.locator('[data-track-chip="service_manager"]').click(); await page.waitForTimeout(900);
  const head = await page.evaluate(() => { const h = document.querySelector("[data-track-panel] [data-track-head]"); return h ? h.textContent : ""; });
  ok("HOME: тап по кружку — название трека в панели («Сервис-менеджер»)", head.includes("Сервис-менеджер"), head.slice(0, 80));
  await page.locator('[data-track-chip="service_manager"]').click(); await page.waitForTimeout(700);
  await shot(page, "home-dark-390");
  ok("HOME: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── NARROW ─────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("NARROW")) {
  for (const [w, h, theme] of [[320, 700, "dark"], [360, 780, "light"], [430, 932, "dark"]]) {
    const { ctx, page } = await open({ w, h, theme });
    await closeBadge(page);
    if (theme === "light") { await page.getByText("Для чтения").first().click().catch(() => {}); await page.waitForTimeout(1200); }
    const ri = await rowInfo(page);
    const over = ri.chips.some((c, i) => i && c.left < ri.chips[i - 1].right - 0.5);
    ok(`NARROW ${w}: шесть кружков в ряд, не наезжают, подписей нет`, ri.chips.length === 6 && !over && ri.caps === 0, ri.chips.map((c) => Math.round(c.left) + "-" + Math.round(c.right)).join(" "));
    ok(`NARROW ${w}: без прокрутки вбок, ряд в экране`, ri.docW <= ri.vw && ri.chips.every((c) => c.left >= 0 && c.right <= ri.vw), ri.docW + " / " + ri.vw);
    await shot(page, "home-" + theme + "-" + w);
    await ctx.close();
  }
}

// ── BTN ────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("BTN")) {
  const { ctx, page } = await open();
  await closeBadge(page);
  await nav(page, "mastery");
  const b = await page.evaluate(() => { const x = [...document.querySelectorAll('[data-lens-btn="main"]')].find((e) => e.offsetParent); if (!x) return null; const cs = getComputedStyle(x); return { t: x.textContent.trim(), bg: cs.backgroundImage, c: cs.color, after: getComputedStyle(x, "::after").display }; });
  ok("BTN: «Путь мастера» — главная кнопка золотом, тёмная надпись, без кольца", !!b && /linear-gradient/.test(b.bg) && b.c === "rgb(36, 24, 10)" && b.after === "none", JSON.stringify(b));
  await shot(page, "btn-mastery");
  await ctx.close();
}
if (want("BTN")) {
  const { ctx, page } = await open();   // разминка — с главной сразу после входа (карточка «сейчас» — «Разминка перед сменой»)
  await closeBadge(page);
  await page.locator("[data-now-cta]").click(); await page.waitForTimeout(1500);
  await page.getByText("Жду, пока гости уйдут").first().click(); await page.waitForTimeout(2600);
  const t = await page.evaluate(() => { const x = [...document.querySelectorAll(".tb-main")].find((e) => /Спасти/.test(e.textContent)); if (!x) return null; const cs = getComputedStyle(x); return { bg: cs.backgroundImage, c: cs.color, after: getComputedStyle(x, "::after").display }; });
  ok("BTN: «Спасти ситуацию» в разминке — золотом, без кольца", !!t && /linear-gradient/.test(t.bg) && t.c === "rgb(36, 24, 10)" && t.after === "none", JSON.stringify(t));
  await shot(page, "btn-warmup");
  await ctx.close();
}

// ── LESSON ─────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("LESSON")) {
  const { ctx, page, errs } = await open();
  await closeBadge(page);
  await openConcept(page);
  await page.waitForFunction(() => { const i = document.querySelector("[data-lp-cover] img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
  const l = await page.evaluate(() => {
    const cov = document.querySelector("[data-lp-cover]"), img = cov && cov.querySelector("img"), first = document.querySelector("[data-lesson-first]");
    const card = document.querySelector("[data-lesson-glass]");
    const cr = cov && cov.getBoundingClientRect(), kr = card && card.getBoundingClientRect();
    return { cover: cov ? cov.getAttribute("data-lp-cover") : null, img: !!(img && img.naturalWidth > 0), edit: !!document.querySelector("[data-lp-edit]"), add: !!document.querySelector("[data-lp-add]"),
      first: first ? first.textContent : "", fs: first ? parseFloat(getComputedStyle(first).fontSize) : 0, edge: cr && kr ? [Math.round(cr.left - kr.left), Math.round(kr.right - cr.right), Math.round(cr.top - kr.top)] : null };
  });
  ok("LESSON: Анна — фото сети над текстом, к краям карточки", l.cover === "net" && l.img && l.edge && l.edge.every((v) => Math.abs(v) <= 1.5), JSON.stringify(l));
  ok("LESSON: первая мысль крупно (19,5 px)", /^Сеть «Два моря» выросла из одного зала/.test(l.first) && l.fs >= 19, l.first.slice(0, 40) + " " + l.fs);
  ok("LESSON: у официанта нет фотоаппарата и «Добавить»", !l.edit && !l.add);
  await shot(page, "lesson-anna");
  // следующий урок раздела — без фото: у Анны ни фото, ни строки «Добавить»
  await page.locator('[aria-label="Следующая карточка"]').first().click().catch(() => {}); await page.waitForTimeout(500);
  ok("LESSON: на второй карточке фото нет", !(await page.evaluate(() => !!document.querySelector("[data-lp-cover]"))));
  ok("LESSON: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── EDIT ───────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("EDIT")) {
  let { ctx, page, errs } = await open({ who: "maria" });
  await closeBadge(page);
  await openConcept(page);
  ok("EDIT: Мария видит фотоаппарат на фото урока", await page.evaluate(() => !!document.querySelector("[data-lp-edit]")));
  await page.locator("[data-lp-edit]").click(); await page.waitForTimeout(900);
  const sh = await page.evaluate(() => {
    const s = document.querySelector("[data-lp-sheet] [role=dialog]"); const cs = s && getComputedStyle(s);
    return { open: !!s, scopes: document.querySelectorAll("[data-lp-scope]").length, other: (document.querySelector("[data-lp-other]") || {}).textContent || "", bg: cs ? cs.backgroundColor : "",
      pick: (document.querySelector("[data-lp-pick]") || {}).textContent || "" };
  });
  ok("EDIT: лист — без выбора места (менеджер: только своё заведение), «Новое заменит его для «Два моря, Океан»»", sh.open && sh.scopes === 0 && /заменит его для «Два моря, Океан»/.test(sh.other), JSON.stringify(sh));
  ok("EDIT: лист непрозрачный, «Выбрать фото»", sh.bg === "rgb(36, 27, 14)" && /Выбрать фото/.test(sh.pick), sh.bg + " " + sh.pick);
  await shot(page, "edit-sheet");
  await page.locator("[data-lp-pick] input[type=file]").setInputFiles(PHOTO);
  await page.waitForFunction(() => !document.querySelector("[data-lp-sheet]"), null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  ok("EDIT: фото с телефона — у урока фото заведения", (await page.evaluate(() => (document.querySelector("[data-lp-cover]") || { getAttribute: () => null }).getAttribute("data-lp-cover"))) === "venue");
  await shot(page, "edit-after");
  // лист снова: теперь превью, «Сменить фото», «Убрать» в два касания
  await page.locator("[data-lp-edit]").click(); await page.waitForTimeout(800);
  const s2 = await page.evaluate(() => ({ now: !!document.querySelector("[data-lp-now]"), pick: (document.querySelector("[data-lp-pick]") || {}).textContent || "", drop: !!document.querySelector("[data-lp-drop]") }));
  ok("EDIT: в листе — «Сейчас: только «Два моря, Океан»», «Сменить фото», «Убрать фото»", s2.now && /Сменить фото/.test(s2.pick) && s2.drop, JSON.stringify(s2));
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  // после перезагрузки (то же состояние демо) у Анны — фото заведения и без фотоаппарата (права — её, не Марии)
  await relogin(page, "anna");
  await openConcept(page);
  await page.waitForTimeout(800);
  const an = await page.evaluate(() => ({ cover: (document.querySelector("[data-lp-cover]") || { getAttribute: () => null }).getAttribute("data-lp-cover"), edit: !!document.querySelector("[data-lp-edit]") }));
  ok("EDIT: Анна после перезагрузки видит фото заведения, фотоаппарата у неё нет", an.cover === "venue" && !an.edit, JSON.stringify(an));
  await relogin(page, "maria");
  await openConcept(page);
  await page.locator("[data-lp-edit]").click(); await page.waitForTimeout(800);
  await page.locator("[data-lp-drop]").click(); await page.waitForTimeout(300);
  ok("EDIT: «Убрать» — второе касание подтверждает", (await page.evaluate(() => (document.querySelector("[data-lp-drop]") || {}).getAttribute && document.querySelector("[data-lp-drop]").getAttribute("data-lp-drop"))) === "sure");
  await page.locator("[data-lp-drop]").click();
  await page.waitForFunction(() => !document.querySelector("[data-lp-sheet]"), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  ok("EDIT: убрали — снова фото сети", (await page.evaluate(() => (document.querySelector("[data-lp-cover]") || { getAttribute: () => null }).getAttribute("data-lp-cover"))) === "net");
  // урок без фото — строка «Добавить фото к уроку»
  await page.locator('[aria-label="Вернуться"]').first().click().catch(() => {}); await page.waitForTimeout(1200);
  await page.getByText("Ценности", { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(1800);
  ok("EDIT: урок без фото — «Добавить фото к уроку»", await page.evaluate(() => !!document.querySelector("[data-lp-add]") && !document.querySelector("[data-lp-cover]")));
  await shot(page, "edit-add");
  ok("EDIT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── OWNER ──────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("OWNER")) {
  const { ctx, page } = await open({ who: "roman" });
  await closeBadge(page);
  await openConcept(page);
  await page.locator("[data-lp-edit]").click(); await page.waitForTimeout(800);
  const o = await page.evaluate(() => ({ scopes: [...document.querySelectorAll("[data-lp-scope]")].map((b) => b.textContent + (b.getAttribute("aria-pressed") === "true" ? "*" : "")), now: !!document.querySelector("[data-lp-now]") }));
  ok("OWNER: Роман — «Вся сеть» (выбрана: там фото) и «Два моря, Океан»", o.scopes.join("|") === "Вся сеть*|«Два моря, Океан»" && o.now, JSON.stringify(o));
  await page.locator('[data-lp-scope="venue"]').click(); await page.waitForTimeout(400);
  ok("OWNER: своё заведение — фото нет, «Новое заменит его для «Два моря, Океан»»", await page.evaluate(() => !document.querySelector("[data-lp-now]") && /заменит его для «Два моря, Океан»/.test((document.querySelector("[data-lp-other]") || {}).textContent || "")));
  await shot(page, "owner-sheet");
  await ctx.close();
}

// ── MOMENT ─────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("MOMENT")) {
  // при входе (занятий ещё не было) — плашкой: экран не загорожен, «Опаздываю?» нажимается
  let { ctx, page, errs } = await open({ badges: false });
  await page.waitForFunction(() => document.querySelector("[data-ms-moment], .ms-toast"), null, { timeout: 20000 }).catch(() => {});
  ok("MOMENT: при входе новый значок — плашкой, не на весь экран", await page.evaluate(() => !document.querySelector("[data-ms-moment]") && !!document.querySelector(".ms-toast")));
  await ctx.close();
  // разминка сразу после входа — значок ждёт (во время занятия праздников нет) и после «На смену» — момент на весь экран
  ({ ctx, page, errs } = await open({ badges: false }));
  const done = await doWarmup(page);
  ok("MOMENT: разминка пройдена до конца («На смену»)", done);
  await page.waitForFunction(() => document.querySelector("[data-ms-moment], .ms-toast"), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1600);
  const m = await page.evaluate(() => { const el = document.querySelector("[data-ms-moment]"); return el ? { tier: el.getAttribute("data-ms-moment"), dlg: !!el.querySelector('[role="dialog"]'), text: el.textContent, btn: !!el.querySelector('[data-lens-btn="main"]') } : null; });
  ok("MOMENT: после занятия новая ступень — момент на весь экран (диалог, «Новый значок · бронза», «Путь мастера ›»)", !!m && m.dlg && /Новый значок · бронза/.test(m.text) && /Путь мастера ›/.test(m.text) && m.btn, JSON.stringify(m));
  ok("MOMENT: время момента записано", !!(await page.evaluate(() => Number(localStorage.getItem("sa_ms_moment_at")) > 0)));
  await shot(page, "moment-dark");
  await page.locator("[data-ms-moment] [data-sa-back]").click().catch(() => {}); await page.waitForTimeout(600);
  ok("MOMENT: «Позже» закрывает", !(await page.evaluate(() => !!document.querySelector("[data-ms-moment]"))));
  ok("MOMENT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
  // момент был минуту назад — после занятия значок плашкой (демо при первом входе само чистит память телефона — отметку
  // ставим уже после входа)
  ({ ctx, page, errs } = await open({ badges: false }));
  await page.evaluate(() => localStorage.setItem("sa_ms_moment_at", String(Date.now() - 60000)));
  await doWarmup(page);
  await page.waitForFunction(() => document.querySelector("[data-ms-moment], .ms-toast"), null, { timeout: 20000 }).catch(() => {});
  ok("MOMENT: момент был минуту назад — значок плашкой", await page.evaluate(() => !document.querySelector("[data-ms-moment]") && !!document.querySelector(".ms-toast")));
  await ctx.close();
}

// ── LIGHT ──────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("LIGHT")) {
  const { ctx, page } = await open({ who: "maria" });
  await closeBadge(page);
  await page.getByText("Для чтения").first().click(); await page.waitForTimeout(1300);
  await nav(page, "roleSelect", 1200);
  const g = await page.evaluate(() => {
    const st = document.querySelector("[data-now-stub]"), bar = document.querySelector('[data-track-chip="bar"]');
    return { light: document.documentElement.classList.contains("sa-light"), stub: st ? getComputedStyle(st).backgroundImage : "", bar: bar ? getComputedStyle(bar).getPropertyValue("--tc").trim().toUpperCase() : "",
      tools: [...document.querySelectorAll("[data-tool-disc]")].map((d) => { const sv = getComputedStyle(d.querySelector("svg")), b = getComputedStyle(d, "::before");
        return { label: d.parentElement.title, stroke: sv.stroke, glass: b.backgroundColor, top: b.top, after: getComputedStyle(d, "::after").display }; }) };
  });
  ok("LIGHT: «Для чтения» — корешок «Начать» золотом", g.light && /linear-gradient/.test(g.stub), JSON.stringify(g).slice(0, 200));
  ok("LIGHT: цвет Бара — тёмная медь (#93500F)", g.bar === "#93500F", g.bar);
  // Доп. 468: у Марии пятый — «AI-интервью»; линзы светлым стеклом с одним кольцом, значки тёмным золотом, как были
  ok("LIGHT: инструменты — светлое стекло во весь кружок, без внешнего кольца, значки тёмным золотом",
    g.tools.map((t) => t.label).join("|") === "Справочник|Меню|Глоссарий|Чек-листы|AI-интервью"
      && g.tools.every((t) => t.stroke === rgb("#7A5D2A") && t.glass === "rgba(139, 106, 48, 0.09)" && t.top === "0px" && t.after === "none"),
    JSON.stringify(g.tools).slice(0, 400));
  await shot(page, "light-home");
  await openConcept(page);
  await page.locator("[data-lp-edit]").click(); await page.waitForTimeout(800);
  const sb = await page.evaluate(() => getComputedStyle(document.querySelector("[data-lp-sheet] [role=dialog]")).backgroundColor);
  ok("LIGHT: лист «Фото урока» светлый", sb === "rgb(247, 238, 219)", sb);
  const mb = await page.evaluate(() => { const x = document.querySelector("[data-lp-pick]"); const cs = getComputedStyle(x); return cs.color + " " + cs.backgroundImage.slice(0, 40); });
  ok("LIGHT: «Выбрать фото» — золотом, тёмная надпись", /^rgb\(36, 24, 10\) linear-gradient/.test(mb), mb);
  await shot(page, "light-sheet");
  await ctx.close();
}

// ── NOW ────────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("NOW")) {
  const { ctx, page } = await open({ storage: { sa_home_look: "now" } });
  await closeBadge(page);
  const g = await page.evaluate(() => {
    const st = document.querySelector("[data-now-stub]");
    return { lens: document.documentElement.classList.contains("sa-lens"), stub: st ? getComputedStyle(st).backgroundImage : "none", caps: document.querySelectorAll("[data-track-cap]").length,
      tools: [...document.querySelectorAll("[data-tool-disc]")].map((d) => { const sv = getComputedStyle(d.querySelector("svg")); return getComputedStyle(d).backgroundImage + "/" + sv.stroke + "/" + sv.strokeWidth; }) };
  });
  ok("NOW: вид «как сейчас» — без «Линзы» и без золотого корешка", !g.lens && !/linear-gradient\(165deg/.test(g.stub), JSON.stringify(g).slice(0, 300));
  ok("NOW: инструменты как были — плоский кружок, значки золотом, линия 1,8", g.tools.length === 4 && g.tools.every((t) => t === "none/" + rgb("#C8A96E") + "/1.8px"), g.tools.join(" · "));
  ok("NOW: подписей под кружками треков нет и здесь", g.caps === 0, String(g.caps));
  await shot(page, "now-home");
  await ctx.close();
}

// ── REDUCED ────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("REDUCED")) {
  const { ctx, page } = await open({ reduced: true, badges: false });
  await doWarmup(page);
  await page.waitForFunction(() => document.querySelector("[data-ms-moment]"), null, { timeout: 20000 }).catch(() => {});
  const a = await page.evaluate(() => { const m = document.querySelector(".ms-mint"); const s = document.querySelector(".ms-shine"); return m ? { mint: getComputedStyle(m).animationName, shine: getComputedStyle(s, "::after").display } : null; });
  ok("REDUCED: «меньше движения» — медаль без чеканки и блика", !!a && a.mint === "none" && a.shine === "none", JSON.stringify(a));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`итог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
