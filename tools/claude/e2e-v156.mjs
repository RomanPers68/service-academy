// e2e v156 (Доп. 480): «Гид» → «Советы в уроках» — руководителю. Сайт — демо целиком (tools/claude/demo-app/build.mjs; урок по id
// открывает window.__saLesson, экран — window.__saNav).
// Разделы: LEAD (Мария, менеджер, в демо — трек «Новичок»: открыла «Задание дня» — в уроке «3 главных принципа» совета нет;
// «Не сейчас» у совета «Новички»; «Гид»: сводка, группы, «уже открывали · дата», «вернётся дата», «сегодня совет уже был»,
// текст совета по тапу; «Показать советы снова» — отметки с нуля, «Задание дня» снова в «Покажутся», в уроке снова совет), STAFF
// (Анна: карточки нет), LIGHT («Для чтения»), NARROW (320 px).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v156.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5356, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v156";
const SRC = process.env.E2E_SRC || new URL("../..", import.meta.url).pathname;
const { LESSON_TIPS } = await import(join(SRC, "data/lesson-tips.js"));
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
const T1 = "Первый день: нормально бояться", T2 = "3 главных принципа";   // уроки s0-1 и s1-2 (в демо у всех трек «Новичок»)

async function open({ who = "maria", light = false, width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  await page.evaluate(() => localStorage.setItem("sa_lesson_cards", "0"));
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  // тихая подгрузка сводки меню (lib/tip-sync.js) — через 5 с после старта
  await page.waitForFunction(() => !!localStorage.getItem("sa_tip_avail") && !!localStorage.getItem("sa_tip_sync"), null, { timeout: 20000 }).catch(() => {});
  return { ctx, page, errs };
}
const nav = async (page, s, ms = 1600) => { await page.evaluate((x) => window.__saNav(x), s); await page.waitForTimeout(ms); };
const lesson = async (page, id, ms = 1800) => { await page.evaluate((x) => window.__saLesson && window.__saLesson(x), id); await page.waitForTimeout(ms); };
const scrollTip = async (page) => { await page.evaluate(() => { const el = document.querySelector("[data-lesson-tip]"); if (el) el.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(900); };
const today = (page) => page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
const dm = (day) => day.slice(8, 10) + "." + day.slice(5, 7);
const tipState = (page, who = "maria") => page.evaluate((uk) => { try { return JSON.parse(localStorage.getItem("sa_tips_" + uk) || "null"); } catch (e) { return null; } }, UK[who]);
const card = (page) => page.evaluate(() => {
  const c = document.querySelector("[data-guide-tips]");
  if (!c) return null;
  const t = (s, el = c) => { const e = el.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; };
  return {
    open: c.getAttribute("data-guide-tips") === "open", sum: t("[data-guide-tips-sum]"), today: t("[data-guide-tips-today]"), note: t("[data-guide-tips-note]"),
    groups: [...c.querySelectorAll("[data-guide-tips-group]")].map((g) => ({ k: g.getAttribute("data-guide-tips-group"), label: (g.firstElementChild || g).innerText.replace(/\s+/g, " ").trim(),
      rows: [...g.querySelectorAll("[data-guide-tip-row]")].map((r) => ({ id: r.getAttribute("data-guide-tip-row"), why: t("[data-guide-tip-why]", r), text: t("[data-guide-tip-text]", r) })) })),
  };
});
const openGroup = async (page, k) => { await page.locator(`[data-guide-tips-group="${k}"] > div`).first().click(); await page.waitForTimeout(400); };
const guideTips = async (page) => { await nav(page, "guide", 1500); await page.locator("[data-guide-tips-head]").click(); await page.waitForTimeout(500); };
const sumN = (s) => { const m = /^покажутся (\d+) · скрыто (\d+)$/.exec(String(s || "")); return m ? { ok: +m[1], hid: +m[2] } : null; };

// ── LEAD ───────────────────────────────────────────────────────────────────────────────────────
if (want("LEAD")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  const day = await today(page);
  // открыла «Задание дня» — в уроке «3 главных принципа» (там совет только о нём) совета нет
  await nav(page, "daily", 2000);
  await lesson(page, "s1-2"); await scrollTip(page);
  ok("LEAD: «Задание дня» открывали — в уроке «" + T2 + "» совета нет", !(await page.$("[data-lesson-tip]")));
  // «Не сейчас» у совета «Новички» (урок «Первый день: нормально бояться»; руководителю — его название)
  await lesson(page, "s0-1"); await scrollTip(page);
  const t1 = await page.evaluate(() => { const e = document.querySelector("[data-lesson-tip]"); return e ? [e.getAttribute("data-lesson-tip"), (e.querySelector("[data-tip-label]") || {}).textContent] : null; });
  ok("LEAD: в уроке «" + T1 + "» — «Совет · Новички»", !!t1 && t1[0] === "onboarding" && t1[1] === "Совет · Новички", JSON.stringify(t1));
  await page.locator("[data-tip-later]").click().catch(() => {}); await page.waitForTimeout(600);
  // «Гид» → «Советы в уроках»
  await nav(page, "guide", 1500);
  const c0 = await card(page);
  ok("LEAD: в «Гиде» — карточка «Советы в уроках», свёрнута, сводка «покажутся N · скрыто M»", !!c0 && !c0.open && !!sumN(c0.sum) && sumN(c0.sum).ok > 0 && sumN(c0.sum).hid > 0, JSON.stringify(c0));
  const pos = await page.evaluate(() => { const a = [...document.querySelectorAll("[data-lens-card]")].find((e) => /Показать подсказки заново|Готово. Подсказки вернутся/.test(e.innerText));
    const b = document.querySelector("[data-guide-tips]"), g = document.querySelector("[data-guide-key]"); return a && b && g ? [a.getBoundingClientRect().top, b.getBoundingClientRect().top, g.getBoundingClientRect().top] : null; });
  ok("LEAD: карточка — под «Показать подсказки заново», над пунктами гида", !!pos && pos[0] < pos[1] && pos[1] < pos[2], JSON.stringify(pos));
  await page.locator("[data-guide-tips-head]").click(); await page.waitForTimeout(500);
  let c = await card(page);
  const okG = (c.groups.find((g) => g.k === "ok") || { rows: [] });
  ok("LEAD: раскрыта — «Покажутся» открыта первой, у каждого «в конце урока «…»»", c.open && c.groups[0].k === "ok" && okG.rows.length > 0 && okG.rows.every((r) => /^в конце урока «.+»( и ещё в \d+ урок(е|ах))?$/.test(r.why)),
    JSON.stringify(c.groups.map((g) => [g.k, g.rows.length])));
  ok("LEAD: группы по порядку — «Покажутся», «Не сейчас», …, «Уже знакомо», у каждой число", JSON.stringify(c.groups.map((g) => g.k)) === JSON.stringify(c.groups.map((g) => g.k).sort((a, b) => ["ok", "later", "cant", "missed", "used"].indexOf(a) - ["ok", "later", "cant", "missed", "used"].indexOf(b)))
    && c.groups.every((g) => /^(Покажутся|«Не сейчас»|Пока нечего открыть|Пропущены три раза|Уже знакомо) · \d+ ›$/.test(g.label)), JSON.stringify(c.groups.map((g) => g.label)));
  ok("LEAD: «Сегодня совет уже был: «Новички» в уроке «" + T1 + "». Следующий будет завтра.»", c.today === "Сегодня совет уже был: «Новички» в уроке «" + T1 + "». Следующий будет завтра.", c.today);
  // тап по совету — его текст и урок
  const r0 = okG.rows[0];
  await page.locator(`[data-guide-tip-row="${r0.id}"]`).click(); await page.waitForTimeout(400);
  c = await card(page);
  const r1 = c.groups.find((g) => g.k === "ok").rows.find((r) => r.id === r0.id);
  const m = /^Урок «(.+?)»: (.+)$/.exec(r1.text || "");
  const fits = !!m && Object.values(LESSON_TIPS).some((list) => list.some(([f, text]) => f === r0.id && text.replace(/\s+/g, " ") === m[2]));
  ok("LEAD: тап по «" + r0.id + "» — «Урок «…»: текст совета», как в уроке", !!m && fits && r0.why.startsWith("в конце урока «" + m[1] + "»"), r1.text);
  await page.screenshot({ path: join(OUT, "lead-ok.png") });
  // «Не сейчас» и «Уже знакомо»
  await openGroup(page, "later");
  c = await card(page);
  const later = (c.groups.find((g) => g.k === "later") || { rows: [] }).rows;
  const until = (await tipState(page)).later.onboarding;
  const lname = await page.evaluate(() => { const r = document.querySelector('[data-guide-tip-row="onboarding"]'); return r && r.firstElementChild ? r.firstElementChild.textContent : ""; });
  ok("LEAD: «Не сейчас» — «Новички», «вернётся " + dm(until) + "»", later.length === 1 && later[0].id === "onboarding" && lname === "Новички" && later[0].why === "вернётся " + dm(until), JSON.stringify([later, lname]));
  await openGroup(page, "used");
  c = await card(page);
  const used = (c.groups.find((g) => g.k === "used") || { rows: [] }).rows;
  const an = used.find((r) => r.id === "daily");
  ok("LEAD: «Уже знакомо» — «Задание дня», «уже открывали · " + dm(day) + "»", !!an && an.why === "уже открывали · " + dm(day), JSON.stringify(used.slice(0, 6)));
  await page.evaluate(() => { const g = document.querySelector('[data-guide-tips-group="used"]'); if (g) g.scrollIntoView({ block: "start" }); }); await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "lead-used.png") });
  // «Показать советы снова»
  const before = sumN(c.sum);
  await page.locator("[data-guide-tips-reset]").click(); await page.waitForTimeout(800);
  c = await card(page);
  const st = await tipState(page);
  ok("LEAD: «Показать советы снова» — «Готово: советы снова появятся в уроках, по одному в день.»", c.note === "Готово: советы снова появятся в уроках, по одному в день.", c.note);
  ok("LEAD: отметки с нуля, день сброса — сегодня", !!st && st.fresh === day && !Object.keys(st.used).length && !Object.keys(st.later).length && !Object.keys(st.shown).length && !st.day, JSON.stringify(st));
  const after = sumN(c.sum), okAfter = (c.groups.find((g) => g.k === "ok") || { rows: [] }).rows;
  ok("LEAD: после сброса скрытых меньше, «Задание дня» и «Новички» — снова в «Покажутся», «сегодня совет уже был» ушло", !!after && after.hid < before.hid && okAfter.some((r) => r.id === "daily") && okAfter.some((r) => r.id === "onboarding") && !c.today,
    JSON.stringify([before, after, c.today]));
  await page.screenshot({ path: join(OUT, "lead-reset.png") });
  // урок — совет снова есть
  await lesson(page, "s1-2"); await scrollTip(page);
  const t2 = await page.evaluate(() => { const e = document.querySelector("[data-lesson-tip]"); return e ? e.getAttribute("data-lesson-tip") : null; });
  ok("LEAD: в уроке «" + T2 + "» снова совет «Задание дня»", t2 === "daily", t2);
  await guideTips(page);
  c = await card(page);
  ok("LEAD: в «Гиде» — «Сегодня совет уже был: «Задание дня» в уроке «" + T2 + "»…»", c.today === "Сегодня совет уже был: «Задание дня» в уроке «" + T2 + "». Следующий будет завтра.", c.today);
  // открыла «Задание дня» после сброса — совет о нём снова спрятан
  await nav(page, "daily", 1800);
  await guideTips(page);
  await openGroup(page, "used");
  c = await card(page);
  const an2 = ((c.groups.find((g) => g.k === "used") || { rows: [] }).rows).find((r) => r.id === "daily");
  ok("LEAD: «Задание дня» открыли после сброса — снова «уже открывали · " + dm(day) + "»", !!an2 && an2.why === "уже открывали · " + dm(day), JSON.stringify(c.groups.map((g) => [g.k, g.rows.length])));
  ok("LEAD: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── STAFF ──────────────────────────────────────────────────────────────────────────────────────
if (want("STAFF")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await nav(page, "guide", 1500);
  ok("STAFF: у официанта в «Гиде» карточки «Советы в уроках» нет, остальной гид на месте", !(await page.$("[data-guide-tips]")) && !!(await page.$("[data-guide-key]")));
  ok("STAFF: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── LIGHT ──────────────────────────────────────────────────────────────────────────────────────
if (want("LIGHT")) {
  const { ctx, page, errs } = await open({ who: "maria", light: true });
  await guideTips(page);
  const c = await card(page);
  const okG = (c && c.groups.find((g) => g.k === "ok")) || { rows: [] };
  if (okG.rows[0]) { await page.locator(`[data-guide-tip-row="${okG.rows[0].id}"]`).click(); await page.waitForTimeout(400); }
  const ink = await page.evaluate(() => { const r = document.querySelector("[data-guide-tip-row]"); const n = r && r.firstElementChild; return n ? getComputedStyle(n).color : ""; });
  ok("LIGHT: «Для чтения» — карточка раскрыта, тёмный текст, текст совета по тапу", !!c && c.open && /rgb\((\d+), (\d+), (\d+)\)/.test(ink) && Number(ink.match(/\d+/)[0]) < 90 && !!(await page.$("[data-guide-tip-text]")), ink);
  await page.screenshot({ path: join(OUT, "light.png") });
  ok("LIGHT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── NARROW ─────────────────────────────────────────────────────────────────────────────────────
if (want("NARROW")) {
  const { ctx, page, errs } = await open({ who: "maria", width: 320, height: 640 });
  await guideTips(page);
  const okG = ((await card(page)) || { groups: [] }).groups.find((g) => g.k === "ok") || { rows: [] };
  if (okG.rows[0]) { await page.locator(`[data-guide-tip-row="${okG.rows[0].id}"]`).click(); await page.waitForTimeout(400); }
  const fit = await page.evaluate(() => [...document.querySelectorAll("[data-guide-tips], [data-guide-tip-row], [data-guide-tip-text], [data-guide-tips-reset]")].every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; }));
  const ov = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  ok("NARROW: 320 px — карточка, строки, текст совета и кнопка в экране, без сдвига вбок", fit && ov <= 1, String(ov));
  await page.screenshot({ path: join(OUT, "narrow.png") });
  ok("NARROW: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log("итог: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
