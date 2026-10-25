// e2e v79 (Доп. 392): лёгкий старт.
// Разделы:
//   LAZY   — до главной карточки не грузятся экраны руководителя, «Команды», рейтинга, экзамена и живого диалога;
//            после показа главной фоновый прогрев их подтягивает (для работы без сети); собеседование — только руководителю;
//   MB     — программа других ролей: до главной не грузится, после — её подтягивает прогрев; уборка банка ошибок —
//            сирота убрана, день записан, повторный запуск в тот же день — без уборки;
//   GB     — Книга отзывов сразу после главной и на бережной сети (без прогрева): вкладки всех ролей, «N/всего» по всей
//            программе — книга догружает роли сама;
//   SCREEN — ленивые экраны открываются и рисуются: статистика, рейтинг, задание дня, чек-листы, первая неделя, аккаунт,
//            сертификаты, гость недели (живой диалог); у руководителя — «Сотрудники» и аналитика;
//   FONT   — заголовки Piazzolla со своего сервера, к jsDelivr и Google Fonts запросов нет (и в Книге отзывов);
//   LIGHT  — светлая тема и 320 px: без прокрутки вбок и ошибок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v79.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5279, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v79";
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

async function open({ who = "staff", light = false, w = 393, h = 852, role = "seasonal", menu = false, extra = {}, chat = [], reqs = null, seedExtra = {}, thrifty = false } = {}) {
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
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(prof), sa_ai_fab: "1", ["sa_last_role" + uk]: JSON.stringify(role), ["sa_ach_pioneer" + uk]: "1" };
  if (who !== "admin") { seed["sa_completed" + uk] = JSON.stringify(DONE.c); seed["sa_quiz_done" + uk] = JSON.stringify(DONE.q); seed["sa_mastery" + uk] = JSON.stringify({ tiers: {}, fw: false, master: {} }); }
  if (menu) seed.sa_menu_shared = JSON.stringify({ [R0]: TEAM_MENU });
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  Object.assign(seed, seedExtra);
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  if (thrifty) await ctx.addInitScript(() => {   // «экономия трафика»: navigator.connection.saveData
    try { Object.defineProperty(Navigator.prototype, "connection", { configurable: true, get: () => ({ saveData: true, effectiveType: "4g", addEventListener() {}, removeEventListener() {} }) }); } catch (e) {}
  });
  await ctx.addInitScript((seed) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    try { const ss = window.speechSynthesis; if (ss) { ss.speak = (u) => { setTimeout(() => { try { u.onend && u.onend(); } catch (e) {} }, 30); }; ss.cancel = () => {}; } } catch (e) {}
  }, seed);
  const page = await ctx.newPage();
  if (reqs) page.on("request", (r) => reqs.push({ u: r.url(), t: Date.now() }));
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



const LAZY_RE = /\/screens-(team|admin|exam|gamification|dialogue)[-.]/;
const waitHome = (page) => page.waitForFunction(() => { const t = document.querySelector("[data-now-title]"); return !document.getElementById("sa-splash") && t && t.textContent.trim().length > 3; }, null, { timeout: 20000, polling: 100 }).then(() => true).catch(() => false);
const UK = "_Анна_Смирнова";
const MISTAKE = [{ q: "Вопрос, которого нет в программе", options: ["а", "б"], correct: 0, lessonTitle: "Тест", due: 0 }];
const other = (reqs) => [...new Set(reqs.filter((r) => /\/modules-(manager|service_manager|bar)[-.]/.test(r.u)).map((r) => r.u.match(/modules-([a-z_]+)/)[1]))].sort().join();

if (want("LAZY")) {
  for (const who of ["staff", "admin"]) {
    const reqs = [];
    const o = await open({ who, reqs });
    const home = await waitHome(o.page);
    const tHome = Date.now();
    const early = reqs.filter((r) => r.t <= tHome && LAZY_RE.test(r.u)).map((r) => r.u.split("/").pop());
    ok("LAZY " + who + ": главная карточка показалась", home, "");
    ok("LAZY " + who + ": до главной не грузились экраны руководителя, «Команды», рейтинга, экзамена, диалога", !early.length, early.join(", "));
    await sleep(9000);
    const later = [...new Set(reqs.filter((r) => LAZY_RE.test(r.u)).map((r) => (r.u.match(LAZY_RE) || [])[1]))].sort();
    ok("LAZY " + who + ": после главной прогрев подтянул все пять (для работы без сети)", later.join() === "admin,dialogue,exam,gamification,team", later.join());
    const cand = reqs.some((r) => /\/candidate[-.]/.test(r.u));
    ok("LAZY " + who + ": собеседование " + (who === "admin" ? "прогрето" : "не грузится"), who === "admin" ? cand : !cand, String(cand));
    ok("LAZY " + who + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("MB")) {
  {
    const reqs = [];
    const o = await open({ reqs });
    await waitHome(o.page); const tHome = Date.now();
    const before = other(reqs.filter((r) => r.t <= tHome));
    await sleep(12000);
    ok("MB: до главной программа других ролей (менеджер, сервис-менеджер, бар) не грузится", before === "", before);
    ok("MB: после главной прогрев подтянул программу всех ролей (книга отзывов, её плитка и статистика считают по всем)", other(reqs) === "bar,manager,service_manager", other(reqs));
    await o.ctx.close();
  }
  {
    const reqs = [];
    const o = await open({ reqs, seedExtra: { ["sa_mistakes" + UK]: JSON.stringify(MISTAKE) } });
    await waitHome(o.page); const tHome = Date.now();
    const before = other(reqs.filter((r) => r.t <= tHome));
    await sleep(12000);
    const day = await o.page.evaluate((k) => localStorage.getItem(k), "sa_mb_clean" + UK);
    const left = await o.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]").length, "sa_mistakes" + UK);
    ok("MB: есть ошибки — до главной программы других ролей всё равно нет", before === "", before);
    ok("MB: вопрос, которого нет в программе, убран; день уборки записан", left === 0 && /^2026-10-2\d$/.test(day || ""), JSON.stringify({ left, day }));
    // тот же день, новый запуск — уборки нет: сирота ждёт завтрашней
    await o.page.evaluate(([k, v]) => localStorage.setItem(k, v), ["sa_mistakes" + UK, JSON.stringify(MISTAKE)]);
    await o.page.reload({ waitUntil: "load" }); await waitHome(o.page); await sleep(12000);
    const left2 = await o.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]").length, "sa_mistakes" + UK);
    ok("MB: повторный запуск в тот же день — уборки нет (вопрос остался до завтра)", left2 === 1, String(left2));
    ok("MB: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

// Книга отзывов считает по программе всех ролей: вкладки всех ролей — даже если её открыли сразу после главной
// (прогрев ещё не дошёл) и на бережной сети, где прогрева нет вовсе (книга догружает роли сама)
if (want("GB")) {
  const ALL = "Хостес,Новичок,Ядро,Менеджер,Сервис-менеджер,Бар,Сборка,Гость недели";
  for (const thrifty of [false, true]) {
    const tag = "GB" + (thrifty ? " бережная сеть" : "");
    const reqs = [];
    const o = await open({ reqs, thrifty });
    await waitHome(o.page);
    if (thrifty) { await sleep(6000); ok(tag + ": прогрева нет — программа других ролей не грузилась", other(reqs) === "", other(reqs)); }
    await nav(o.page, "guestbook", 2500);
    const gb = await o.page.evaluate(() => {
      const gw = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Гость недели");
      const tabs = gw ? [...gw.parentElement.querySelectorAll("button")].map((b) => b.textContent.trim()) : [];
      const head = document.querySelector(".sa-screen") ? document.querySelector(".sa-screen").innerText : "";
      return { tabs, more: !!document.querySelector("[data-seg-more]"), of: (head.match(/(\d+)\/(\d+)/) || [])[2] || "" };
    });
    ok(tag + ": вкладки всех ролей, у края — намёк «листай»", gb.tabs.join() === ALL && gb.more, JSON.stringify(gb));
    // v79: по всем ролям — 56 страниц, по открытым официанту (хостес, новичок, ядро) — 37
    ok(tag + ": «N/всего» — по программе всех ролей, а не только открытых", +gb.of > 45, gb.of);
    await shot(o.page, "gb" + (thrifty ? "-thrifty" : ""));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("SCREEN")) {
  for (const who of ["staff", "admin"]) {
    const o = await open({ who, menu: true });
    await waitHome(o.page);
    const list = [["stats", /Моя статистика|уроков/], ["leaderboard", /Рейтинг|Пока пусто|место/i], ["daily", /Задани|сегодня/i], ["checklist", /Открытие|Чек-лист/i],
      ["onboarding", /Первая неделя|Новички|день/i], ["profile", /Аккаунт|Для чтения|Выйти/i], ["certificates", /Сертификат|экзамен/i], ["weeklyGuest", /Гость|гост/i]];
    if (who === "admin") list.push(["team", /Сотрудники|код/i], ["analytics", /Аналитика|недел/i]);
    const bad = [];
    for (const [s, re] of list) {
      await nav(o.page, s, 1800);
      const t = await o.page.evaluate(() => document.body.innerText);
      if (!re.test(t)) bad.push(s + ": " + t.replace(/\s+/g, " ").slice(0, 90));
      if (who === "staff" && ["stats", "weeklyGuest"].includes(s)) await shot(o.page, "lazy-" + s);
    }
    ok("SCREEN " + who + ": ленивые экраны открываются (" + list.length + ")", !bad.length, bad.join(" | "));
    ok("SCREEN " + who + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("FONT")) {
  const reqs = [];
  const o = await open({ reqs });
  await waitHome(o.page); await sleep(1500);
  const f = await o.page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].filter((x) => /Piazzolla/.test(x.family)).map((x) => x.status);
    return { faces, check: document.fonts.check("700 20px Piazzolla", "Урок") };
  });
  const own = reqs.some((r) => /\/assets\/fonts\/piazzolla-cyrillic-700-normal\.woff2$/.test(r.u));
  const ext = reqs.filter((r) => /jsdelivr|googleapis|gstatic/.test(r.u)).map((r) => r.u);
  ok("FONT: Piazzolla загружен со своего сервера", own && f.faces.includes("loaded") && f.check, JSON.stringify(f));
  ok("FONT: к jsDelivr и Google Fonts запросов нет", !ext.length, ext.join(", "));
  await nav(o.page, "guestbook", 2200);
  const g = await o.page.evaluate(async () => { await document.fonts.ready; return { marck: [...document.fonts].filter((x) => /Marck/.test(x.family)).map((x) => x.status), css: !!document.getElementById("sa-table-css") }; });
  const ext2 = reqs.filter((r) => /jsdelivr|googleapis|gstatic/.test(r.u)).map((r) => r.u);
  await shot(o.page, "guestbook");
  ok("FONT: Книга отзывов — Marck Script свой, Google Fonts не зовётся", g.css && g.marck.length > 0 && !ext2.length, JSON.stringify(g) + " " + ext2.join(", "));
  ok("FONT: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("LIGHT")) {
  for (const [w, light] of [[393, true], [320, false]]) {
    const o = await open({ light, w });
    const side = [];
    for (const s of ["roleSelect", "stats", "leaderboard", "checklist", "profile", "certificates"]) { await nav(o.page, s); if (!(await noSide(o.page))) side.push(s); }
    ok("LIGHT " + (light ? "светлая " : "") + w + ": без прокрутки вбок", !side.length, side.join(", "));
    ok("LIGHT " + (light ? "светлая " : "") + w + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
