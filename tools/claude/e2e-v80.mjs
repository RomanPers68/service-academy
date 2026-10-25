// e2e v80 (Доп. 393): голос шефа и сомелье, «Как произносить».
// Разделы:
//   TILES  — в тренажёре меню плитки «Голоса шефа и сомелье» (есть записи) и «Как произносить»; без записей — только словарь;
//   CARD   — оборот карточки блюда: «Как произносить» (из словаря и своё ударение менеджера), кнопки голосов играют по
//            одной, карточка от нажатия не переворачивается;
//   VOICES — список голосов: «Слушать подряд» идёт по очереди, «Стоп» останавливает;
//   SAY    — словарь: разделы, поиск, знак ударения; живой голос (radio-tts: say / say_o), без него — голос телефона;
//            «повторить» — запись себя и «я»;
//   REC    — менеджер: поле «Как произносить» с превью, запись голоса шефа (микрофон Chromium) → voice-upload (WAV),
//            блюдо с голосом, публикация несёт voice, после неё — уборка (sweep); у официанта записи нет;
//   LIGHT  — светлая тема и 320 px: без прокрутки вбок и ошибок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v80.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5280, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v80";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SEASONAL_MODULES } = await import(SRC + "/data/modules-seasonal.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp", ".wav": "audio/wav" };
// короткие звуки для проверки: 0,8 с тона, 16 кГц моно — собираем здесь же, в памяти
const tone = (hz, sec = 0.8, rate = 16000) => {
  const n = Math.round(rate * sec), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin(2 * Math.PI * hz * i / rate)), 44 + i * 2);
  return b;
};
const WAVS = { "/test-voice-a.wav": tone(440), "/test-voice-b.wav": tone(660) };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  if (WAVS[p]) { res.writeHead(200, { "Content-Type": "audio/wav" }); res.end(WAVS[p]); return; }
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(PORT, r));

const R0 = "Два моря, Океан";
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const ADMIN = { id: "u-admin", name: "Роман", surname: "Петров", restaurant: R0, position: "manager", is_admin: true };
const NOW = new Date("2026-10-23T02:20:00Z");
const doneMap = (...mods) => { const c = {}, q = {}; mods.forEach(m => m.lessons.forEach(l => { if (l.type === "quiz") q[l.id] = true; else if (l.type !== "result") c[l.id] = true; })); return { c, q }; };
const S = (id) => SEASONAL_MODULES.find(m => m.id === id);
const DONE = doneMap(S("s0"), S("s1"));
const URL_A = `http://localhost:${PORT}/test-voice-a.wav`, URL_B = `http://localhost:${PORT}/test-voice-b.wav`;
const MENU_V = [
  { id: "t1", name: "Буррата с томатами", cat: "Закуски", ingredients: ["буррата", "томаты", "базилик"], allergens: ["Молоко"],
    voice: { chef: { url: URL_A, sec: 1, name: "Алексей", at: 1 }, som: { url: URL_B, sec: 1, name: "Мария", at: 1 } } },
  { id: "t2", name: "Тартар из гребешка с юдзу", cat: "Закуски", ingredients: ["гребешок", "юдзу", "кунжут"], allergens: ["Моллюски и ракообразные", "Кунжут"],
    say: "Тарт+ар из гребешк+а с +юдзу", voice: { chef: { url: URL_A + "?2", sec: 1, name: "Алексей", at: 1 } } },
  { id: "t3", name: "Чизкейк с солёной карамелью", cat: "Десерты", ingredients: ["сливочный сыр", "карамель"], allergens: ["Молоко", "Глютен"] },
];
const MENU_PLAIN = MENU_V.map(({ voice, say, ...d }) => d);

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function open({ who = "staff", light = false, w = 393, h = 852, menu = MENU_V, tts = true, calls = null } = {}) {
  const prof = who === "admin" ? ADMIN : STAFF;
  const uk = "_" + prof.name + "_" + prof.surname;
  const C = calls || { up: [], tts: [], set: [] };
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 900, hasTouch: w < 900, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce", permissions: ["microphone"] });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\/voice-upload/.test(u)) {
      C.up.push({ ...body, audioHead: String(body.audio || "").slice(0, 40), audioLen: String(body.audio || "").length, audio: undefined });
      if (body.sweep) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, kept: 3, removed: 0 }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, url: URL_B + "?up=" + C.up.length }) });
    }
    if (/\/functions\/v1\/radio-tts/.test(u)) {
      C.tts.push(body);
      if (body.probe) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, configured: tts, talk: tts }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tts ? { ok: true, url: URL_A + "?tts=" + C.tts.length, cached: false } : { ok: false, error: "not_configured" }) });
    }
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      if (m[1] === "menu_set") { C.set.push(body); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }); }
      const mock = { whoami: { ok: true, employee: prof }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: who === "admin" ? [] : Object.keys(DONE.q), lessons: who === "admin" ? [] : Object.keys(DONE.c), stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] },
        schedule_load: { ok: false, error: "auth" }, menu_get: menu, menu_progress_team: { ok: true, rows: [] } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(prof), sa_ai_fab: "1", ["sa_last_role" + uk]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + uk]: "1",
    sa_menu_shared: JSON.stringify({ [R0]: menu }) };
  if (who !== "admin") { seed["sa_completed" + uk] = JSON.stringify(DONE.c); seed["sa_quiz_done" + uk] = JSON.stringify(DONE.q); seed["sa_mastery" + uk] = JSON.stringify({ tiers: {}, fw: false, master: {} }); }
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    // голос телефона: запоминаем, что и на каком языке он сказал бы
    window.__ss = [];
    try { const ss = window.speechSynthesis; if (ss) { ss.speak = (u) => { window.__ss.push({ text: u.text, lang: u.lang }); setTimeout(() => { try { u.onend && u.onend(); } catch (e) {} }, 30); }; ss.cancel = () => {}; } } catch (e) {}
    // какие звуки реально запускались (и в каком порядке)
    window.__played = [];
    const P = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { try { window.__played.push(String(this.src || this.currentSrc || "")); } catch (e) {} return P.apply(this, arguments); };
  }, seed);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  return { ctx, page, errors, C };
}
const nav = async (page, to, wait = 1500) => { await page.evaluate((to) => window.__saNav(to), to); await sleep(wait); };
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const noSide = (p) => p.evaluate(() => { const r = document.getElementById("root"); return document.documentElement.scrollWidth <= innerWidth + 1 && (!r || r.scrollWidth <= r.clientWidth + 1); });
const ACUTE = String.fromCharCode(0x301);
const tap = async (page, sel) => { const l = page.locator(sel).first(); if (!(await l.count())) return false; await l.click(); await sleep(400); return true; };
const mode = (page, key) => tap(page, `[data-menu-mode="${key}"]`);
const pills = (page, scope = "body") => page.evaluate((scope) => [...document.querySelectorAll(scope + " [data-voice]")].map((b) => ({ k: b.getAttribute("data-voice"), st: b.getAttribute("data-voice-state"), t: b.innerText.replace(/\s+/g, " ").trim() })), scope);

if (want("TILES")) {
  const o = await open({});
  await nav(o.page, "menuTrainer", 1800);
  const t = await o.page.evaluate(() => [...document.querySelectorAll("[data-menu-mode]")].map((e) => ({ k: e.getAttribute("data-menu-mode"), t: e.innerText.replace(/\s+/g, " ").trim() })));
  const v = t.find((x) => x.k === "voices"), s = t.find((x) => x.k === "say");
  ok("TILES: «Голоса шефа и сомелье» — три записи и общее время", !!v && /Голоса шефа и сомелье/.test(v.t) && /3 записи · 0:03/.test(v.t), JSON.stringify(v));
  ok("TILES: «Как произносить» — вино, кухня, бар", !!s && /Как произносить/.test(s.t) && /Вино, кухня, бар/.test(s.t), JSON.stringify(s));
  ok("TILES: у официанта нет редактора меню", !(await o.page.locator("text=Редактор меню").count()));
  await shot(o.page, "tiles");
  ok("TILES: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
  const o2 = await open({ menu: MENU_PLAIN });
  await nav(o2.page, "menuTrainer", 1800);
  const t2 = await o2.page.evaluate(() => [...document.querySelectorAll("[data-menu-mode]")].map((e) => e.getAttribute("data-menu-mode")));
  ok("TILES: записей нет — плитки голосов нет, словарь есть", !t2.includes("voices") && t2.includes("say"), t2.join(","));
  await o2.ctx.close();
}

if (want("CARD")) {
  const o = await open({});
  await nav(o.page, "menuTrainer", 1800);
  await mode(o.page, "cards"); await sleep(800);
  await o.page.locator(".sa-ck-wrap").first().click(); await sleep(900);
  const back = await o.page.evaluate(() => { const b = document.querySelector(".sa-ck-back"); const s = b && b.querySelector("[data-sayline]"); return { say: s ? s.innerText.replace(/\s+/g, " ").trim() : "", flipped: /rotateY\(180deg\)/.test((document.querySelector(".sa-ck-inner") || {}).style?.transform || "") }; });
  ok("CARD: «Как произносить» на обороте — «бурра́та» со знаком ударения и оригиналом", /Как произносить/.test(back.say) && back.say.includes("Бурра" + ACUTE + "та") && /burrata/.test(back.say), back.say);
  const p0 = await pills(o.page, ".sa-ck-back");
  ok("CARD: голоса шефа и сомелье с именами и временем", p0.length === 2 && /Шеф · Алексей/.test(p0[0].t) && /0:01/.test(p0[0].t) && /Сомелье · Мария/.test(p0[1].t), JSON.stringify(p0));
  await o.page.locator('.sa-ck-back [data-voice="chef"]').click(); await sleep(500);
  const p1 = await pills(o.page, ".sa-ck-back");
  await o.page.locator('.sa-ck-back [data-voice="som"]').click(); await sleep(500);
  const p2 = await pills(o.page, ".sa-ck-back");
  const still = await o.page.evaluate(() => /rotateY\(180deg\)/.test((document.querySelector(".sa-ck-inner") || {}).style?.transform || ""));
  const played = await o.page.evaluate(() => window.__played.filter((s) => /test-voice/.test(s)));
  ok("CARD: шеф играет; нажали сомелье — шеф смолк, играет сомелье", /load|play/.test(p1[0].st) && p1[1].st === "idle" && p2[0].st === "idle" && /load|play/.test(p2[1].st), JSON.stringify([p1, p2]));
  ok("CARD: звуки — те самые записи; карточка от нажатий не перевернулась", played.length >= 2 && /test-voice-a/.test(played[0]) && /test-voice-b/.test(played[played.length - 1]) && still, JSON.stringify(played));
  await shot(o.page, "card-back");
  await sleep(1200);
  const p3 = await pills(o.page, ".sa-ck-back");
  ok("CARD: запись доиграла — кнопка снова «слушать»", p3[1].st === "idle", JSON.stringify(p3));
  // второе блюдо: своё ударение менеджера
  await o.page.locator(".sa-ck-wrap").first().click(); await sleep(700);
  await o.page.locator("button", { hasText: "дальше ›" }).click(); await sleep(900);
  await o.page.locator(".sa-ck-wrap").first().click(); await sleep(900);
  const say2 = await o.page.evaluate(() => { const s = document.querySelector(".sa-ck-back [data-sayline]"); return s ? s.innerText.replace(/\s+/g, " ").trim() : ""; });
  ok("CARD: своё ударение менеджера — «Тарта́р из гребешка́ с ю́дзу»", say2.includes("Тарта" + ACUTE + "р из гребешка" + ACUTE + " с ю" + ACUTE + "дзу"), say2);
  ok("CARD: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("VOICES")) {
  const o = await open({});
  await nav(o.page, "menuTrainer", 1800);
  await mode(o.page, "voices"); await sleep(900);
  const list = await o.page.evaluate(() => [...document.querySelectorAll("[data-voices-dish]")].map((e) => e.getAttribute("data-voices-dish")));
  ok("VOICES: два блюда с записями, в порядке меню", list.join() === "t1,t2", list.join());
  await shot(o.page, "voices");
  await o.page.locator("[data-voices-all]").click();
  // записи по 0,8 с: следим за строкой «Звучит: … · N из 3», пока очередь не кончится
  const seen = [];
  for (let k = 0; k < 25; k++) {
    await sleep(200);
    const s = await o.page.evaluate(() => ({ on: document.querySelector("[data-voices-all]").getAttribute("data-voices-all"), now: (document.querySelector("[aria-live]") || {}).innerText || "" }));
    const n = (s.now.match(/(\d) из 3/) || [])[1];
    if (n && seen[seen.length - 1] !== n) seen.push(n);
    if (s.on === "off" && seen.length) break;
  }
  const end = await o.page.evaluate(() => ({ on: document.querySelector("[data-voices-all]").getAttribute("data-voices-all"), played: window.__played.filter((s) => /test-voice/.test(s)) }));
  ok("VOICES: «Слушать подряд» — все три записи по очереди, потом очередь сама кончилась", seen.join() === "1,2,3" && end.on === "off" && end.played.length === 3, JSON.stringify({ seen, end }));
  await o.page.locator("[data-voices-all]").click(); await sleep(300);
  const c1 = await o.page.evaluate(() => document.querySelector("[data-voices-all]").getAttribute("data-voices-all"));
  await o.page.locator("[data-voices-all]").click(); await sleep(300);
  const c2 = await o.page.evaluate(() => document.querySelector("[data-voices-all]").getAttribute("data-voices-all"));
  ok("VOICES: «Стоп» останавливает очередь посередине", c1 === "on" && c2 === "off", JSON.stringify([c1, c2]));
  ok("VOICES: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("SAY")) {
  for (const tts of [true, false]) {
    const tag = "SAY" + (tts ? "" : " без живых голосов");
    const o = await open({ tts });
    await nav(o.page, "menuTrainer", 1800);
    await mode(o.page, "say"); await sleep(900);
    const own = await o.page.evaluate(() => [...document.querySelectorAll("[data-pron-word]")].map((e) => e.innerText));
    if (tts) {
      ok(tag + ": первым — «Наше меню»: слова из названий и своё ударение", own.includes("Бурра" + String.fromCharCode(0x301) + "та") && own.some((x) => x.startsWith("Тарта" + String.fromCharCode(0x301) + "р из")), JSON.stringify(own));
      await shot(o.page, "say-menu");
      await tap(o.page, '[data-pron-cat="wine"]');
      const n = await o.page.locator("[data-pron-item]").count();
      ok(tag + ": «Вино» — больше полусотни слов", n > 50, String(n));
      await shot(o.page, "say-wine");
    }
    await o.page.locator('input[placeholder^="Найти"]').fill("шардоне"); await sleep(500);
    const found = await o.page.evaluate(() => [...document.querySelectorAll("[data-pron-word]")].map((e) => e.innerText));
    ok(tag + ": поиск без ударений находит «Шардоне́»", found.length === 1 && found[0] === "Шардоне" + ACUTE, JSON.stringify(found));
    await o.page.locator('[data-pron-item] [data-say="ru"]').first().click(); await sleep(900);
    await o.page.locator('[data-pron-item] [data-say="orig"]').first().click(); await sleep(900);
    if (tts) {
      const said = o.C.tts.filter((b) => !b.probe).map((b) => ({ who: b.who, text: b.text }));
      ok(tag + ": живой голос: по-русски со знаком ударения (say), оригинал — Chardonnay (say_o)", said.length === 2 && said[0].who === "say" && said[0].text === "Шардоне" + ACUTE && said[1].who === "say_o" && said[1].text === "Chardonnay", JSON.stringify(said));
      const played = await o.page.evaluate(() => window.__played.filter((s) => /tts=/.test(s)).length);
      ok(tag + ": голоса прозвучали", played >= 2, String(played));
    } else {
      const ss = await o.page.evaluate(() => window.__ss);
      ok(tag + ": голос телефона: «Шардоне» без знака по-русски, «Chardonnay» по-французски", ss.length === 2 && ss[0].text === "Шардоне" && ss[0].lang === "ru-RU" && ss[1].text === "Chardonnay" && ss[1].lang === "fr-FR", JSON.stringify(ss));
      // повторить за голосом: запись себя (микрофон Chromium) → «я»
      await o.page.locator("[data-repeat]").first().click(); await sleep(1600);
      const recSt = await o.page.locator("[data-repeat]").first().getAttribute("data-repeat");
      await o.page.locator("[data-repeat]").first().click(); await sleep(1200);
      const mine = await o.page.locator("[data-repeat-mine]").count();
      ok(tag + ": «повторить» — идёт запись, после «стоп» — кнопка «я»", recSt === "rec" && mine === 1, JSON.stringify({ recSt, mine }));
      await shot(o.page, "say-repeat");
    }
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("REC")) {
  const o = await open({ who: "admin", menu: MENU_PLAIN });
  await nav(o.page, "menuTrainer", 1800);
  await o.page.locator("text=Редактор меню").first().click(); await sleep(900);
  await o.page.locator("button", { hasText: /Добавить блюдо|^\+ Блюдо$/ }).first().click(); await sleep(700);
  await o.page.locator('textarea[placeholder="Название блюда *"], input[placeholder="Название блюда *"]').first().fill("Ризотто с белыми грибами");
  await o.page.locator('[placeholder^="Как произносить"]').first().fill("Риз+отто с белыми грибами"); await sleep(300);
  const prev = await o.page.evaluate(() => (document.querySelector("[data-say-preview]") || {}).innerText || "");
  ok("REC: «Как произносить» — превью со знаком ударения", prev.includes("Ризо" + ACUTE + "тто"), prev);
  await o.page.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(300);
  const recs = await o.page.evaluate(() => [...document.querySelectorAll("[data-voice-rec]")].map((e) => e.getAttribute("data-voice-rec")));
  ok("REC: в форме блюда — запись шефа и сомелье", recs.join() === "chef,som", recs.join());
  const chef = o.page.locator('[data-voice-rec="chef"]');
  await chef.scrollIntoViewIfNeeded();
  await chef.locator("button", { hasText: "Записать" }).click(); await sleep(2600);
  const ph1 = await chef.getAttribute("data-voice-phase");
  await shot(o.page, "rec-recording");
  await chef.locator("button", { hasText: "Готово" }).click(); await sleep(1200);
  const ph2 = await chef.getAttribute("data-voice-phase");
  await chef.locator('input[placeholder^="Кто говорит"]').fill("шеф Алексей");   // «шеф» в имени — без повтора в подписи
  await shot(o.page, "rec-review");
  await chef.locator("button", { hasText: "Сохранить" }).click(); await sleep(1800);
  const up = o.C.up.find((b) => !b.sweep);
  const ph3 = await chef.getAttribute("data-voice-phase");
  const saved = await pills(o.page, '[data-voice-rec="chef"]');
  ok("REC: запись → прослушать → сохранить; подпись «Шеф Алексей» без повтора", ph1 === "rec" && ph2 === "review" && ph3 === "idle" && saved.length === 1 && /^Шеф Алексей 0:0\d$/.test(saved[0].t), JSON.stringify({ ph1, ph2, ph3, saved }));
  ok("REC: в облако ушёл WAV (запись Chromium — webm, телефон перевёл), блюдо и вид записи", !!up && up.kind === "chef" && /^data:audio\/wav;base64,/.test(up.audioHead) && up.audioLen > 20000 && up.restaurant === R0 && /Ризотто/.test(up.dishId), JSON.stringify(up));
  await shot(o.page, "rec-saved");
  await o.page.locator("button", { hasText: "Добавить в меню" }).first().click(); await sleep(900);
  const own = await o.page.evaluate(() => { try { return (JSON.parse(localStorage.getItem("sa_menu_custom") || "{}")["Два моря, Океан"] || []).find((d) => /Ризотто/.test(d.name)); } catch (e) { return null; } });
  ok("REC: блюдо сохранилось с голосом шефа и ударением", !!own && own.voice && own.voice.chef && /test-voice-b\.wav\?up=/.test(own.voice.chef.url) && own.voice.chef.name === "шеф Алексей" && own.say === "Риз+отто с белыми грибами", JSON.stringify(own && { voice: own.voice, say: own.say }));
  await o.page.locator("button", { hasText: /^Опубликовать/ }).first().click(); await sleep(1500);
  const pub = o.C.set.length ? JSON.parse(o.C.set[o.C.set.length - 1].p_dishes || "[]") : [];
  const pd = pub.find((d) => /Ризотто/.test(d.name));
  ok("REC: публикация несёт голос; после неё — уборка старых записей", !!pd && pd.voice && pd.voice.chef && o.C.up.some((b) => b.sweep && b.restaurant === R0), JSON.stringify({ pd: pd && pd.voice, sweep: o.C.up.filter((b) => b.sweep).length }));
  ok("REC: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("LIGHT")) {
  for (const [w, light] of [[393, true], [320, false]]) {
    const o = await open({ light, w });
    await nav(o.page, "menuTrainer", 1800);
    const side = [];
    for (const k of ["say", "voices"]) { await mode(o.page, k); await sleep(700); if (!(await noSide(o.page))) side.push(k); await shot(o.page, `light-${k}-${w}${light ? "-light" : ""}`); await nav(o.page, "home", 600); await nav(o.page, "menuTrainer", 1200); }
    ok("LIGHT " + (light ? "светлая " : "") + w + ": словарь и голоса без прокрутки вбок", !side.length, side.join(", "));
    ok("LIGHT " + (light ? "светлая " : "") + w + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
