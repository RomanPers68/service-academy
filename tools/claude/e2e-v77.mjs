// e2e v77 (Доп. 390): Наставнику вернули человечность.
// Разделы:
//   HUMAN  — пустой экран Наставника: значок «AI» в круге, «Привет, Анна!», «Я знаю стандарты… Спрашивай как коллегу»;
//            ответ ИИ: смайлики, «Отличный вопрос!» и «Надеюсь, помог!» остаются, разметка («###», «-», цифры-эмодзи в начале
//            пункта, «---», *курсив*) — обычным текстом; тёмная и светлая тема;
//   LIMIT  — лимит вопросов: «…Загляни в уроки или SOS: там тоже много ответов!»;
//   GUEST  — живой гость как в v76: действие серой строкой курсивом, без звёздочек и эмодзи;
//   LIGHT  — светлая тема и 320 px: Наставник без прокрутки вбок и ошибок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v77.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5277, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v77";
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

async function open({ who = "staff", light = false, w = 393, h = 852, role = "seasonal", menu = false, extra = {}, chat = [], ai = null } = {}) {
  const prof = who === "admin" ? ADMIN : STAFF;
  const uk = "_" + prof.name + "_" + prof.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 900, hasTouch: w < 900, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    if (/\/functions\/v1\/ai-chat/.test(u)) {
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      chat.push(body);
      if (ai && body.mode !== "guest") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ai(body)) });
      const reply = body.mode === "guest" ? GUEST_LINE : SLOPPY;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply, remaining: 18, v: 77 }) });
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


if (want("HUMAN")) {
  for (const light of [false, true]) {
    const tag = "HUMAN" + (light ? " светлая" : "");
    const chat = [];
    const o = await open({ light, chat });
    await nav(o.page, "assistant", 1500);
    const e = await o.page.evaluate(() => {
      const hello = document.querySelector("[data-mentor-hello]");
      const card = hello && hello.parentElement;
      return { hello: hello ? hello.textContent.trim() : "", text: card ? card.innerText : "", icon: !!(card && card.querySelector(".sa-pop svg")) };
    });
    await shot(o.page, "mentor-hello" + (light ? "-light" : ""));
    ok(tag + ": пустой экран — «Привет, Анна!» и значок «AI» в круге", e.hello === "Привет, Анна!" && e.icon, JSON.stringify(e).slice(0, 160));
    ok(tag + ": «Я знаю стандарты… помогу с любой рабочей ситуацией… Спрашивай как коллегу»", /Я знаю стандарты Service Academy и помогу с любой рабочей ситуацией/.test(e.text) && /Спрашивай как коллегу/.test(e.text) && !/Наставник знает уроки/.test(e.text), e.text.replace(/\n/g, " / ").slice(0, 200));
    await o.page.locator("button", { hasText: "Гость недоволен блюдом. Что говорить?" }).first().click({ timeout: 6000 }).catch(() => {});
    await sleep(1600);
    const r = await o.page.evaluate((src) => {
      const re = new RegExp(src, "gu");
      const bubbles = [...document.querySelectorAll(".dlg-in")];
      const last = bubbles[bubbles.length - 1];
      if (!last) return null;
      return { text: last.innerText, bold: [...last.querySelectorAll("b")].map((b) => b.textContent), emoji: (last.innerText.match(re) || []).length };
    }, EMOJI_SRC);
    await shot(o.page, "mentor-warm" + (light ? "-light" : ""));
    ok(tag + ": ИИ ответил, вопрос ушёл", !!r && chat.length === 1 && !chat[0].mode, JSON.stringify(chat.map((b) => b.mode || "mentor")));
    ok(tag + ": тёплые фразы на месте — «Отличный вопрос!» в начале, «Надеюсь, помог!» в конце", !!r && /^Отличный вопрос!/.test(r.text.trim()) && /Надеюсь, помог!/.test(r.text), r && r.text.replace(/\n/g, " / ").slice(0, 220));
    ok(tag + ": смайлики в ответе остаются (4 из 4)", !!r && r.emoji === 4, r && String(r.emoji));
    ok(tag + ": разметка — обычным текстом: жирная строка, «1.», «•», без «#», «---» и звёздочек",
      !!r && r.bold.includes("Что делать") && r.bold.includes("Извинись") && /^1\. Извинись/m.test(r.text) && /^• Позови менеджера/m.test(r.text) && !/#|---|\*/.test(r.text), r && r.text.replace(/\n/g, " / ").slice(0, 220));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("LIMIT")) {
  const o = await open({ ai: () => ({ ok: false, error: "daily_limit" }) });
  await nav(o.page, "assistant", 1500);
  await o.page.locator("button", { hasText: "Гость недоволен блюдом. Что говорить?" }).first().click({ timeout: 6000 }).catch(() => {});
  await sleep(1500);
  const t = await o.page.evaluate(() => document.body.innerText);
  await shot(o.page, "mentor-limit");
  ok("LIMIT: «На сегодня лимит вопросов Наставнику исчерпан… там тоже много ответов!»", /лимит вопросов Наставнику исчерпан \(20 в сутки\)/.test(t) && /Загляни в уроки или SOS: там тоже много ответов!/.test(t), (t.match(/[^\n]*лимит вопросов[^\n]*/) || [""])[0].slice(0, 200));
  ok("LIMIT: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
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
  const o = await open({ menu: true });
  await guestTalk(o.page);
  const g = await o.page.evaluate((src) => {
    const re = new RegExp(src, "u");
    const b = [...document.querySelectorAll(".tb .lg-g")];
    const last = b[b.length - 1];
    if (!last) return null;
    const act = last.querySelector(".lg-act");
    return { text: last.innerText, act: act ? act.textContent : "", emoji: re.test(last.innerText) };
  }, EMOJI_SRC);
  ok("GUEST: действие — серой строкой без звёздочек, эмодзи гость не «говорит» (как в v76)", !!g && g.act === "смотрит на часы" && !/\*/.test(g.text) && !g.emoji, g && g.text.replace(/\n/g, " / "));
  ok("GUEST: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("LIGHT")) {
  for (const [w, light] of [[393, true], [320, false]]) {
    const o = await open({ light, w });
    await nav(o.page, "assistant");
    ok("LIGHT " + (light ? "светлая " : "") + w + ": Наставник без прокрутки вбок", await noSide(o.page));
    ok("LIGHT " + (light ? "светлая " : "") + w + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
