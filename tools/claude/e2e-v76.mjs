// e2e v76 (Доп. 389): факты Справочника и ответы ИИ без примет нейросети.
// Разделы:
//   REF     — Справочник: глава «Бокалы» — «Карта вкуса — миф», без «зон языка» и картинки-карты; Ридель по фактам;
//             «Школы сервировки мира» — у Английской один настоящий снимок, сгенерированного нет;
//   MENTOR  — Наставник: ответ ИИ с «###», «-», «1️⃣» — на экране жирная строка, «•», «1.», без «#», «---» и звёздочек
//             (v77: пустой экран с «Привет, Анна!», смайлики и тёплые фразы вернули — их проверяет e2e-v77);
//   GUEST   — живой гость: «*смотрит на часы*» — серой строкой курсивом без звёздочек, эмодзи в реплике нет; гостю уходит
//             меню команды без заготовок, а без меню команды — заготовки;
//   PRAISE  — на 30 экранах у сотрудника и руководителя нет похвал с «!» («Так держать!», «Экзамен сдан!» и т. п.);
//   LIGHT   — светлая тема и 320 px: Наставник и Справочник без прокрутки вбок и ошибок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v76.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5276, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v76";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SEASONAL_MODULES } = await import(SRC + "/data/modules-seasonal.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const asked = [];   // запросы картинок справочника
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); if (p.startsWith("/reference/")) asked.push(p); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));

const R0 = "Два моря, Океан";
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const ADMIN = { id: "u-admin", name: "Роман", surname: "Петров", restaurant: R0, position: "manager", is_admin: true };
const NOW = new Date("2026-10-23T02:20:00Z");   // 23.10, 14:20 по Камчатке
const doneMap = (...mods) => { const c = {}, q = {}; mods.forEach(m => m.lessons.forEach(l => { if (l.type === "quiz") q[l.id] = true; else if (l.type !== "result") c[l.id] = true; })); return { c, q }; };
const S = (id) => SEASONAL_MODULES.find(m => m.id === id);
const DONE = doneMap(S("s0"), S("s1"));
const TEAM_MENU = [
  { id: "t1", name: "Тартар из гребешка с юдзу", cat: "Закуски", ingredients: ["гребешок", "юдзу", "кунжут"], allergens: ["Моллюски и ракообразные", "Кунжут"] },
  { id: "t2", name: "Чизкейк с солёной карамелью и фундуком", cat: "Десерты", ingredients: ["сливочный сыр", "карамель", "фундук"], allergens: ["Молоко", "Орехи", "Глютен"] },
];
// ответ «как у чат-бота»: всё, что экран должен вычистить
const SLOPPY = "Отличный вопрос! 😊\n\n### Что делать\n1️⃣ **Извинись** перед гостем.\n2️⃣ Предложи замену 🍽️\n- Позови менеджера, если гость настаивает.\n\n---\n✅ Главное — *спокойно*.\n\nНадеюсь, помог! 👍";
const GUEST_LINE = "*смотрит на часы* Простите, а горячее скоро? 🙄 [[mood:3]]";
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function open({ who = "staff", light = false, w = 393, h = 852, role = "seasonal", menu = false, extra = {}, chat = [] } = {}) {
  const prof = who === "admin" ? ADMIN : STAFF;
  const uk = "_" + prof.name + "_" + prof.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 900, hasTouch: w < 900, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    if (/\/functions\/v1\/ai-chat/.test(u)) {
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      chat.push(body);
      const reply = body.mode === "guest" ? GUEST_LINE : SLOPPY;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply, remaining: 18, v: 76 }) });
    }
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const mock = { whoami: { ok: true, employee: prof }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: who === "admin" ? [] : Object.keys(DONE.q), lessons: who === "admin" ? [] : Object.keys(DONE.c), stars: {}, roles: [], last_role: role },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] },
        schedule_load: { ok: false, error: "auth" }, menu_get: menu ? TEAM_MENU : [], ...extra };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(prof), sa_ai_fab: "1", ["sa_last_role" + uk]: JSON.stringify(role), ["sa_ach_pioneer" + uk]: "1" };
  if (who !== "admin") { seed["sa_completed" + uk] = JSON.stringify(DONE.c); seed["sa_quiz_done" + uk] = JSON.stringify(DONE.q); seed["sa_mastery" + uk] = JSON.stringify({ tiers: {}, fw: false, master: {} }); }
  if (menu) seed.sa_menu_shared = JSON.stringify({ [R0]: TEAM_MENU });
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    try { const ss = window.speechSynthesis; if (ss) { ss.speak = (u) => { setTimeout(() => { try { u.onend && u.onend(); } catch (e) {} }, 30); }; ss.cancel = () => {}; } } catch (e) {}
  }, seed);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}
const nav = async (page, to, wait = 1500) => { await page.evaluate((to) => window.__saNav(to), to); await sleep(wait); };
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const noSide = (p) => p.evaluate(() => { const r = document.getElementById("root"); return document.documentElement.scrollWidth <= innerWidth + 1 && (!r || r.scrollWidth <= r.clientWidth + 1); });
const EMOJI_SRC = "\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F";
const clickText = async (page, text, sel = "body *") => {
  const done = await page.evaluate(([text, sel]) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => e.children.length === 0 && e.textContent.trim() === text);
    const el = els.find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (!el) return false;
    (el.closest("button,[role=button],a,[tabindex]") || el).click(); return true;
  }, [text, sel]);
  await sleep(1100); return done;
};
// глава справочника: курс → глава, текст и картинки
async function refChapter(page, course, chapter) {
  await nav(page, "home", 900);   // справочник помнит открытую главу, пока он на экране
  await nav(page, "reference", 1600);
  const a = await clickText(page, course);
  const b = await clickText(page, chapter);
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
  const info = await page.evaluate(() => ({ text: document.body.innerText, imgs: [...document.querySelectorAll("img")].map((i) => i.getAttribute("src") || "").filter((s) => s.includes("/reference/")) }));
  return { ...info, opened: a && b };
}

if (want("REF")) {
  const o = await open({});
  const g = await refChapter(o.page, "Вина", "Бокалы: форма и история");
  ok("REF: глава «Бокалы» открылась", g.opened && /Бокалы: форма и история/.test(g.text), g.text.slice(0, 80));
  ok("REF: «Карта вкуса — миф», вкусы — всей поверхностью языка", /Карта вкуса — миф/.test(g.text) && /язык чувствует всей поверхностью/.test(g.text) && /1901 года/.test(g.text), "");
  ok("REF: «зон языка» и списка «кончик — сладость» нет, картинки-карты нет", !/Кончик языка|Ближе к гортани|зоны языка/.test(g.text) && !g.imgs.some((s) => s.includes("wine_taste_map")), JSON.stringify(g.imgs));
  ok("REF: Ридель — 1958, 1973 и 1986, без «первым доказал»", /В 1958 году/.test(g.text) && /в 1973-м/.test(g.text) && /в 1986 году/.test(g.text) && !/первым доказал/.test(g.text));
  ok("REF: приписка владельца про чаевые на месте", /повышает шанс на чаевые, проверено/.test(g.text));
  await o.page.evaluate(() => { const el = [...document.querySelectorAll("b,strong,div,span")].find((e) => e.textContent.trim() === "Карта вкуса — миф"); if (el) el.scrollIntoView({ block: "center" }); }); await sleep(400);
  await shot(o.page, "ref-glasses");
  const s = await refChapter(o.page, "Сервировка", "Школы сервировки мира");
  await o.page.evaluate(() => { const el = [...document.querySelectorAll("b,strong,div,span")].find((e) => /Английская — этикет и серебро/.test(e.textContent) && e.children.length === 0); if (el) el.scrollIntoView({ block: "start" }); }); await sleep(900);
  const s2 = await o.page.evaluate(() => [...document.querySelectorAll("img")].map((i) => i.getAttribute("src") || "").filter((x) => x.includes("/reference/school_english")));
  await shot(o.page, "ref-english");
  ok("REF: у Английской школы — один настоящий снимок, сгенерированного нет", s.opened && s2.length === 1 && s2[0].includes("school_english_2") && !asked.some((p) => p.includes("school_english_1")), JSON.stringify(s2));
  ok("REF: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("MENTOR")) {
  for (const light of [false, true]) {
    const tag = "MENTOR" + (light ? " светлая" : "");
    const chat = [];
    const o = await open({ light, chat });
    await nav(o.page, "assistant", 1500);
    if (!light) await shot(o.page, "mentor-empty");
    // v77: пустой экран снова с приветствием — проверка в e2e-v77 (HUMAN)
    await o.page.locator("button", { hasText: "Гость недоволен блюдом. Что говорить?" }).first().click({ timeout: 6000 }).catch(() => {});
    await sleep(1600);
    const r = await o.page.evaluate((src) => {
      const re = new RegExp(src, "u");
      const bubbles = [...document.querySelectorAll(".dlg-in")];
      const last = bubbles[bubbles.length - 1];
      if (!last) return null;
      return { text: last.innerText, bold: [...last.querySelectorAll("b")].map((b) => b.textContent), emoji: re.test(last.innerText) };
    }, EMOJI_SRC);
    await shot(o.page, "mentor-reply" + (light ? "-light" : ""));
    ok(tag + ": ИИ ответил, вопрос ушёл", !!r && chat.length === 1 && !chat[0].mode, JSON.stringify(chat.map((b) => b.mode || "mentor")));
    ok(tag + ": заголовок «###» — жирной строкой, «1️⃣» — «1.», «-» — «•»",
      !!r && r.bold.includes("Что делать") && r.bold.includes("Извинись") && /^1\. Извинись/m.test(r.text) && /^• Позови менеджера/m.test(r.text) && !/#|---/.test(r.text), r && r.text.slice(0, 200));
    ok(tag + ": без звёздочек разметки (v77: смайлики и тёплые фразы остаются — e2e-v77)", !!r && !/\*/.test(r.text), r && r.text.replace(/\n/g, " / ").slice(0, 200));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

async function guestTalk(page) {
  await nav(page, "shift", 1200);
  await page.locator('.sa-card[aria-label="Живой гость"]').first().click({ timeout: 6000 }).catch(() => {});
  await sleep(1400);
  await page.locator(".tb .tb-main").first().click({ timeout: 6000 }).catch(() => {}); await sleep(1200);
  await page.locator(".tb .lg-in").fill("Добрый вечер! Горячее уже готовится, будет через пять минут.").catch(() => {});
  await page.locator(".tb .lg-send").click().catch(() => {}); await sleep(1500);
}

if (want("GUEST")) {
  const chat = [];
  const o = await open({ menu: true, chat });
  await guestTalk(o.page);
  const g = await o.page.evaluate((src) => {
    const re = new RegExp(src, "u");
    const b = [...document.querySelectorAll(".tb .lg-g")];
    const last = b[b.length - 1];
    if (!last) return null;
    const act = last.querySelector(".lg-act");
    return { text: last.innerText, act: act ? act.textContent : "", italic: act ? getComputedStyle(act).fontStyle : "", block: act ? getComputedStyle(act).display : "", emoji: re.test(last.innerText) };
  }, EMOJI_SRC);
  await shot(o.page, "guest-action");
  ok("GUEST: действие гостя — «смотрит на часы» отдельной строкой курсивом", !!g && g.act === "смотрит на часы" && g.italic === "italic" && g.block === "block", JSON.stringify(g));
  ok("GUEST: в реплике нет звёздочек и эмодзи, слова гостя на месте", !!g && !/\*/.test(g.text) && !g.emoji && /Простите, а горячее скоро\?/.test(g.text), g && g.text.replace(/\n/g, " / "));
  const sent = chat.filter((b) => b.mode === "guest");
  const menu = (sent[0] && sent[0].guest && sent[0].guest.menu) || [];
  // ещё одна реплика: в истории для модели прежний ответ гостя — как пришёл, со звёздочками
  await o.page.locator(".tb .lg-in").fill("Уточню на кухне и сразу вернусь.").catch(() => {});
  await o.page.locator(".tb .lg-send").click().catch(() => {}); await sleep(1500);
  const sent2 = chat.filter((b) => b.mode === "guest");
  const lastMsgs = (sent2[sent2.length - 1] || {}).messages || [];
  ok("GUEST: модели уходит исходный текст гостя (со звёздочками)", lastMsgs.some((m) => m.role === "assistant" && /\*смотрит на часы\*/.test(m.content)), JSON.stringify(lastMsgs.map((m) => m.role + ": " + String(m.content).slice(0, 40))));
  ok("GUEST: есть меню команды — гостю только оно, без заготовок", menu.some((x) => /Тартар из гребешка/.test(x)) && !menu.some((x) => /Креветка темпура|Ассорти паштетов/.test(x)), JSON.stringify(menu).slice(0, 200));
  ok("GUEST: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
  // без меню команды — заготовки Океана
  const chat2 = [];
  const o2 = await open({ chat: chat2 });
  await guestTalk(o2.page);
  const menu2 = ((chat2.find((b) => b.mode === "guest") || {}).guest || {}).menu || [];
  ok("GUEST: меню команды нет — гостю заготовки ресторана", menu2.some((x) => /Креветка темпура/.test(x)) && !menu2.some((x) => /Тартар из гребешка/.test(x)), JSON.stringify(menu2).slice(0, 160));
  ok("GUEST: без меню команды — без ошибок в консоли", !o2.errors.length, o2.errors.slice(0, 3).join(" | "));
  await o2.ctx.close();
}

const SCREENS = ["roleSelect", "shift", "teamHub", "me", "home", "reference", "glossary", "menuTrainer", "cocktails", "guestbook", "mastery", "cellar",
  "stats", "league", "leaderboard", "mentor", "search", "daily", "checklist", "onboarding", "guide", "offline", "mistakes", "certificates",
  "weeklyGuest", "analytics", "team", "candidate", "contentEditor", "profile"];
const PRAISE = "(?:Отлично|Так держать|Мастер сервиса|Хороший результат|Тренируйся ещё|Сильная неделя|Экзамен сдан|пройден[аоы]?|Время вышло|Колода пройдена|знаешь меню|первый тест)!";   // v77: «…много ответов!» — снова голос Наставника
if (want("PRAISE")) {
  for (const who of ["staff", "admin"]) {
    const o = await open({ who, menu: true });
    const found = {};
    for (const s of SCREENS) {
      await nav(o.page, s, 1200);
      const hit = await o.page.evaluate((src) => (document.body.innerText.match(new RegExp(src, "gu")) || []), PRAISE);
      if (hit.length) found[s] = hit;
    }
    ok("PRAISE " + who + ": на " + SCREENS.length + " экранах нет похвал с «!»", !Object.keys(found).length, JSON.stringify(found).slice(0, 400));
    ok("PRAISE " + who + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("LIGHT")) {
  for (const [w, light] of [[393, true], [320, false]]) {
    const o = await open({ light, w });
    const side = [];
    for (const s of ["assistant", "reference", "shift"]) { await nav(o.page, s); if (!(await noSide(o.page))) side.push(s); }
    ok("LIGHT " + (light ? "светлая " : "") + w + ": без прокрутки вбок", !side.length, side.join(", "));
    ok("LIGHT " + (light ? "светлая " : "") + w + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
