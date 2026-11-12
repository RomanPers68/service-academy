// e2e v148 (Доп. 472): советы в уроках. Сайт — демо целиком (tools/claude/demo-app/build.mjs: сервер в странице, люди
// демо; урок по id открывает window.__saLesson — крючок сборки демо).
// Разделы: CARD (Анна, урок карточками: совета нет на первой карточке, на последней — над «Закрепить у стола»; тот текст,
// что в data/lesson-tips.js; кнопка — линза как «Урок пройден ✓»; показ записан; ни одной золотой кнопки),
// SCROLL (лентой: совет внизу, показ засчитан только когда его видно), DAY (увиден — в другом уроке сегодня тишина,
// в том же — тот же), LATER («Не сейчас» — совет пропал, функция спрятана на 14 дней), NOTYPE (тест и практика — без
// советов), GO (кнопка ведёт туда, куда обещает: «Радио», «Свеча на двоих», «Напоминания», календарь, «Опиши за
// 60 секунд», аллергены на скорость, Наставник с готовым вопросом, «Сомелье» сразу с подбором, глава Справочника,
// «Мой отчёт», «Путь мастера», «Навыки в зале»; функция отмечена; «назад» из Справочника — в урок, совета больше нет),
// LEAD (Мария: совет руководителя и подпись «Новички»; Анне в том же уроке — не руководительский), LIGHT («Для чтения»).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v148.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5348, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v148";
const SRC = process.env.E2E_SRC || new URL("../..", import.meta.url).pathname;
const { LESSON_TIPS, TIP_FEATURES } = await import(join(SRC, "data/lesson-tips.js"));
const { REFERENCE_DAILY_INDEX } = await import(join(SRC, "data/reference-index.js"));
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
const UK = { anna: "_Анна_Смирнова", maria: "_Мария_Ким" };
const textOf = (lesson, f) => ((LESSON_TIPS[lesson] || []).find(([x]) => x === f) || [])[1];

const boot = async (page, errs, cards = true) => {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  // вид урока (карточки / лента) — после загрузки: демо при старте раскладывает свои ключи заново
  await page.evaluate((c) => localStorage.setItem("sa_lesson_cards", c ? "1" : "0"), cards);
  // значки «Пути мастера» и окна бота в Telegram — закрываются сами, чтобы не загораживать урок
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
};
async function open({ who = "anna", light = false, cards = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await boot(page, errs, cards);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
const reload = async (page, errs, cards = false) => { await page.goto(URL0, { waitUntil: "load" }); await boot(page, errs, cards); };
const today = (page) => page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
const tipState = (page, who = "anna") => page.evaluate((uk) => { try { return JSON.parse(localStorage.getItem("sa_tips_" + uk) || "null"); } catch (e) { return null; } }, UK[who]);
const setTipState = (page, v, who = "anna") => page.evaluate(([uk, val]) => { if (val == null) localStorage.removeItem("sa_tips_" + uk); else localStorage.setItem("sa_tips_" + uk, JSON.stringify(val)); }, [UK[who], v]);
const lesson = async (page, id, ms = 1800) => { const r = await page.evaluate((x) => window.__saLesson ? window.__saLesson(x) : false, id); await page.waitForTimeout(ms); return r; };
const tipInfo = (page) => page.evaluate(() => {
  const el = document.querySelector("[data-lesson-tip]");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const go = el.querySelector("[data-tip-go]"), lab = el.querySelector("[data-tip-label]"), tx = el.querySelector("[data-tip-text]");
  return { id: el.getAttribute("data-lesson-tip"), label: lab ? lab.textContent : "", text: tx ? tx.textContent.replace(/\u00A0/g, " ") : "", cta: go ? go.textContent : "", top: r.top, bottom: r.bottom, h: r.height,
    go: go ? { bg: getComputedStyle(go).backgroundImage + "|" + getComputedStyle(go).backgroundColor, c: getComputedStyle(go).color, sh: getComputedStyle(go).boxShadow.slice(0, 40) } : null };
});
const finishBtn = (page) => page.evaluate(() => {
  const els = [...document.querySelectorAll("button")].filter((b) => /Закрепить у стола|Урок пройден/.test(b.textContent || "") && b.getBoundingClientRect().height > 0);
  return els.map((b) => { const r = b.getBoundingClientRect(), cs = getComputedStyle(b); return { t: (b.textContent || "").trim().slice(0, 30), top: r.top, soft: b.getAttribute("data-lens-btn") === "soft",
    bg: cs.backgroundImage + "|" + cs.backgroundColor, c: cs.color, sh: cs.boxShadow.slice(0, 40) }; });
});
const toLast = async (page) => {
  for (let i = 0; i < 30; i++) {
    const last = await page.evaluate(() => { const n = document.querySelector("[aria-label='Следующая карточка']"); return !n || getComputedStyle(n).opacity < 0.3; });
    if (last) return true;
    await page.locator("[aria-label='Следующая карточка']").first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(450);
  }
  return false;
};
const scrollTip = async (page) => { await page.evaluate(() => { const el = document.querySelector("[data-lesson-tip]"); if (el) el.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(900); };
const goldScan = (page) => page.evaluate(() => [...document.querySelectorAll('[data-lens-btn="main"], .tb-main')].filter((el) => el.getBoundingClientRect().width > 0)
  .filter((el) => { const cs = getComputedStyle(el); return /linear-gradient\(172deg/.test(cs.backgroundImage) || cs.color === "rgb(36, 24, 10)"; }).length);
const bodyText = (page) => page.evaluate(() => document.body.innerText || "");

// ── CARD ──────────────────────────────────────────────────────────────────────────────────────────────────
if (want("CARD")) {
  const { ctx, page, errs } = await open({ who: "anna", cards: true });
  const L = "s0-2";
  ok("CARD: урок открылся по id", await lesson(page, L));
  const first = await tipInfo(page);
  ok("CARD: на первой карточке совета нет", first === null, JSON.stringify(first));
  ok("CARD: до последней карточки дошли", await toLast(page));
  await page.waitForTimeout(700);
  const t = await tipInfo(page);
  ok("CARD: на последней карточке — совет из «своих» этого урока", !!t && LESSON_TIPS[L].some(([f]) => f === t.id), JSON.stringify(t));
  ok("CARD: текст — из data/lesson-tips.js, подпись «Совет · функция», кнопка со стрелкой",
    !!t && t.text === textOf(L, t.id) && t.label === "Совет · " + (TIP_FEATURES[t.id] || {}).name && /›$/.test(t.cta), JSON.stringify(t));
  const fb = await finishBtn(page);
  ok("CARD: совет — над «Закрепить у стола» / «Урок пройден»", !!t && fb.length > 0 && fb.every((b) => b.top > t.bottom - 1), JSON.stringify({ t, fb }));
  const soft = fb.find((b) => b.soft);
  ok("CARD: кнопка совета — линза, как «Урок пройден ✓» рядом (стекло, ободок, цвет надписи)", !!t && !!t.go && !!soft && t.go.bg === soft.bg && t.go.c === soft.c && t.go.sh === soft.sh, JSON.stringify({ go: t && t.go, soft }));
  const st = await tipState(page), day = await today(page);
  ok("CARD: показ записан — день, урок, функция, один показ", !!st && !!t && st.day === day && st.lesson === L && st.f === t.id && st.shown[t.id] === 1, JSON.stringify(st));
  ok("CARD: на экране ни одной золотой кнопки", (await goldScan(page)) === 0);
  const ic = await page.evaluate(() => { const el = document.querySelector("[data-lesson-tip] [data-tip-icon] svg"); return el ? el.innerHTML.length : 0; });
  ok("CARD: у «Радио в дорогу» — значок из «Пути мастера»", !!t && t.id === "radio" ? ic > 40 : true, String(ic));
  await scrollTip(page);
  await page.screenshot({ path: join(OUT, "tip-card-dark.png") });
  ok("CARD: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── SCROLL + DAY + LATER ───────────────────────────────────────────────────────────────────────────────────
if (want("SCROLL") || want("DAY") || want("LATER")) {
  const { ctx, page, errs } = await open({ who: "anna", cards: false });
  const A = "s1-2", B = "s0-3";
  await lesson(page, A);
  const list = await page.evaluate(() => !document.querySelector("[aria-label='Следующая карточка']"));
  ok("SCROLL: урок открыт лентой", list);
  const t = await tipInfo(page), fb0 = await finishBtn(page);
  ok("SCROLL: лентой — совет в конце урока, над кнопками; на экране меньше половины", !!t && t.top > 400 && t.top > 844 - t.h / 2 && fb0.length > 0 && fb0.every((x) => x.top > t.bottom - 1)
    && LESSON_TIPS[A].some(([f]) => f === t.id), JSON.stringify({ t, fb0 }));
  const st0 = await tipState(page);
  ok("SCROLL: пока совет не на экране — показ не засчитан (совет дня не потрачен)", !st0 || !st0.day, JSON.stringify(st0));
  await scrollTip(page);
  const st1 = await tipState(page), day = await today(page);
  ok("SCROLL: совет на экране — показ засчитан", !!st1 && !!t && st1.day === day && st1.lesson === A && st1.f === t.id, JSON.stringify(st1));
  await page.screenshot({ path: join(OUT, "tip-scroll-dark.png") });
  // DAY
  await lesson(page, B);
  ok("DAY: в другом уроке сегодня совета нет", (await tipInfo(page)) === null);
  await lesson(page, A);
  const t2 = await tipInfo(page);
  ok("DAY: в том же уроке — тот же совет", !!t2 && !!t && t2.id === t.id, JSON.stringify(t2));
  // LATER
  await scrollTip(page);
  await page.locator("[data-tip-later]").first().click();
  await page.waitForTimeout(700);
  ok("LATER: «Не сейчас» — совет пропал", (await tipInfo(page)) === null);
  const st2 = await tipState(page);
  const plus14 = await page.evaluate(() => { const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 14, 12); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; });
  ok("LATER: функция спрятана на 14 дней", !!st2 && !!t && st2.later && st2.later[t.id] === plus14, JSON.stringify(st2));
  await lesson(page, B); await lesson(page, A);
  ok("LATER: урок открыли снова — совета нет", (await tipInfo(page)) === null);
  ok("SCROLL/DAY/LATER: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── NOTYPE ────────────────────────────────────────────────────────────────────────────────────────────────
if (want("NOTYPE")) {
  const { ctx, page, errs } = await open({ who: "anna", cards: false });
  for (const id of ["s0-p", "s0-q"]) {
    await lesson(page, id, 2200);
    ok(`NOTYPE: ${id} (${id.endsWith("q") ? "тест" : "практика"}) — без совета`, (await tipInfo(page)) === null);
  }
  ok("NOTYPE: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── GO ────────────────────────────────────────────────────────────────────────────────────────────────────
if (want("GO")) {
  const { ctx, page, errs } = await open({ who: "anna", cards: false });
  const day = await today(page);
  const chapter = (id) => (REFERENCE_DAILY_INDEX.find((r) => r.id === id) || {}).title || "?";
  const extra = (L, f) => (LESSON_TIPS[L].find(([x]) => x === f) || [])[2] || {};
  let viaTip = "";
  const CASES = [
    { L: "s0-2", f: "radio", check: async () => /Радио/.test(await bodyText(page)) },
    { L: "s0-2", f: "pair", check: async () => /Свеча на двоих/.test(await bodyText(page)) },
    { L: "s0-2", f: "remind", check: async () => /Напоминани/.test(await bodyText(page)) },
    { L: "s0-3", f: "phonecal", check: async () => /календар/i.test(await bodyText(page)) },
    { L: "s-prod-2", f: "describe", check: async () => { const b = await bodyText(page); return /Опиши за 60 секунд/.test(b) && /У тебя минута/.test(b) && /Старт/.test(b); } },
    { L: "s5-1", f: "sprint", check: async () => /аллерген/i.test(await bodyText(page)) },
    { L: "s-prod-3", f: "assistant", check: async () => (await bodyText(page)).includes(extra("s-prod-3", "assistant").ask || "—") },
    { L: "s-prod-5", f: "sommelier", check: async () => page.evaluate(() => !!document.querySelector("[data-som]")) },
    { L: "s7-2", f: "reference", check: async () => (await bodyText(page)).includes(chapter(extra("s7-2", "reference").ref)), back: true },
    // «Мой отчёт» — экран отчёта сразу со своей карточкой (в демо сервер отчётов не обновлён — сверяем с «Я» → «Мой отчёт»)
    { L: "s1-3", f: "myreport", check: async () => { viaTip = await bodyText(page); return /отч[её]т/i.test(viaTip); } },
    { L: "s0-4", f: "mastery", check: async () => /Путь мастера/.test(await bodyText(page)) },
    { L: "s3-1", f: "hall", check: async () => /Навык/.test(await bodyText(page)) },
  ];
  for (const c of CASES) {
    const others = LESSON_TIPS[c.L].map(([f]) => f).filter((f) => f !== c.f);
    await reload(page, errs);
    await setTipState(page, { used: Object.fromEntries(others.map((f) => [f, day])) });
    await lesson(page, c.L);
    const t = await tipInfo(page);
    if (!t || t.id !== c.f) { ok(`GO ${c.f}: совет «${(TIP_FEATURES[c.f] || {}).name}» в уроке ${c.L}`, false, JSON.stringify(t)); continue; }
    await scrollTip(page);
    if (c.f === "reference") await page.screenshot({ path: join(OUT, "tip-reference-dark.png") });
    await page.locator("[data-tip-go]").first().click();
    await page.waitForTimeout(2200);
    const good = await c.check();
    const st = await tipState(page);
    ok(`GO ${c.f}: «${t.cta}» открывает ${TIP_FEATURES[c.f].name}${c.f === "reference" ? " — глава «" + chapter(extra(c.L, c.f).ref) + "»" : ""}; функция отмечена`, good && !!st && !!st.used && st.used[c.f] === day, JSON.stringify({ good, used: st && st.used }));
    if (["sommelier", "describe", "assistant", "myreport"].includes(c.f)) await page.screenshot({ path: join(OUT, "go-" + c.f + ".png") });
    if (c.back) {
      const back = page.locator("[data-ref-back], [aria-label='Вернуться'], [aria-label='Назад']").first();
      if (await back.count()) await back.click().catch(() => {}); else await page.goBack().catch(() => {});
      await page.waitForTimeout(1600);
      const fb = await finishBtn(page);
      ok("GO reference: «назад» — снова конец урока, совета про Справочник больше нет", fb.length > 0 && (await tipInfo(page)) === null, JSON.stringify(fb));
    }
  }
  await reload(page, errs);
  await page.evaluate(() => window.__saNav && window.__saNav("me")); await page.waitForTimeout(1300);
  await page.getByText("Итоги и документы").first().click().catch(() => {});   // группы в «Я» свёрнуты
  await page.waitForTimeout(700);
  await page.getByText("Мой отчёт", { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(2200);
  const viaMe = await bodyText(page);
  ok("GO myreport: тот же экран, что «Я» → «Мой отчёт»", !!viaTip && viaTip === viaMe, JSON.stringify({ viaTip: viaTip.slice(0, 160), viaMe: viaMe.slice(0, 160) }));
  ok("GO: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── LEAD ──────────────────────────────────────────────────────────────────────────────────────────────────
if (want("LEAD")) {
  const m = await open({ who: "maria", cards: false });
  await lesson(m.page, "m1-2");
  const t = await tipInfo(m.page);
  ok("LEAD: Мария, «Брифинг — инструмент менеджера» — совет руководителя «Брифинг смены»", !!t && t.id === "brief" && TIP_FEATURES.brief.staff, JSON.stringify(t));
  await setTipState(m.page, null, "maria");
  await lesson(m.page, "s0-1");
  const n = await tipInfo(m.page);
  ok("LEAD: руководителю «Первая неделя» подписана «Новички»", !!n && n.id === "onboarding" && n.label === "Совет · Новички", JSON.stringify(n));
  ok("LEAD: без ошибок страницы (Мария)", !m.errs.length, m.errs.join(" | "));
  await m.ctx.close();
  const a = await open({ who: "anna", cards: false });
  await lesson(a.page, "m1-2");
  const ta = await tipInfo(a.page);
  ok("LEAD: Анне в том же уроке — не руководительский совет", ta === null || !TIP_FEATURES[ta.id].staff, JSON.stringify(ta));
  await setTipState(a.page, null);
  await lesson(a.page, "s0-1");
  const na = await tipInfo(a.page);
  ok("LEAD: Анне — «Совет · Первая неделя»", !!na && na.label === "Совет · Первая неделя", JSON.stringify(na));
  await a.ctx.close();
}

// ── LIGHT ─────────────────────────────────────────────────────────────────────────────────────────────────
if (want("LIGHT")) {
  const { ctx, page, errs } = await open({ who: "anna", light: true, cards: true });
  await lesson(page, "s0-2");
  await toLast(page); await page.waitForTimeout(700);
  const t = await tipInfo(page);
  const fb = await finishBtn(page);
  const soft = fb.find((b) => b.soft);
  const sizes = await page.evaluate(() => { const el = document.querySelector("[data-lesson-tip]"); if (!el) return null; const tx = el.querySelector("[data-tip-text]"), go = el.querySelector("[data-tip-go]");
    return { text: getComputedStyle(tx).fontSize, color: getComputedStyle(tx).color, go: getComputedStyle(go).color }; });
  ok("LIGHT: «Для чтения» — совет на месте, текст 16 px тёмным, кнопка — как «Урок пройден ✓»", !!t && !!sizes && sizes.text === "16px" && !!soft && t.go.c === soft.c && t.go.bg === soft.bg, JSON.stringify({ sizes, go: t && t.go, soft }));
  ok("LIGHT: ни одной золотой кнопки", (await goldScan(page)) === 0);
  await scrollTip(page);
  await page.screenshot({ path: join(OUT, "tip-card-light.png") });
  ok("LIGHT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`итог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
