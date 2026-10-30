// e2e v42 (Доп. 355): «Живой гость» знает роль. Хостес встречает гостя у входа (встреча, бронь, рассадка —
// гость не делает ей заказ, чек не спрашивает аперитив), менеджеру — гость, который позвал менеджера, бармену —
// гость у стойки, официанту — как раньше. Пункты чека и слова экрана — по роли; в ai-chat уходит трек.
// Разделы: TILE DOOR PHONE EXIT EARLY OLD MGR BAR HALL BAD SCRIPT EDIT SHOT
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5262, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v42";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SEASONAL_MODULES } = await import(SRC + "/data/modules-seasonal.js");
const { SPG_MODULES } = await import(SRC + "/data/modules-spg.js");
const { MANAGER_MODULES } = await import(SRC + "/data/modules-manager.js");
const MODS = [...SEASONAL_MODULES, ...SPG_MODULES, ...MANAGER_MODULES];
const ALL_SITS = MODS.flatMap(m => m.lessons).filter(l => l.type === "practice").flatMap(l => l.situations || []);
const ALL_Q = MODS.flatMap(m => m.lessons).filter(l => l.type === "quiz").flatMap(l => l.questions || []);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const STAFF = { id: "u-staff", name: "Роман", surname: "Смирнов", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
const BOSS = { id: "u-boss", name: "Ольга", surname: "Белова", restaurant: "Два моря, Океан", position: "manager", is_admin: false };
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ответы «Живого гостя»: три реплики по роли, на третьей — конец; чек разбора — JSON с пунктами роли
// (ai: "old" — сервер до v42: пункты официанта для любой роли; "bad" — сервер не знает гостя; "off" — ИИ нет)
const KEYS = { hall: ["contact", "menu", "care", "sales", "calm"], door: ["contact", "book", "care", "seat", "calm"], bar: ["contact", "drinks", "care", "sales", "calm"], manager: ["contact", "listen", "care", "solve", "calm"] };
const LESSON = { hall: "s0-2", door: "spg-4-2", bar: "bar0-2", manager: "m4-1" };
const REPLIES = {
  hall: ["Да, мне бы что-нибудь побыстрее — у меня поезд. Что посоветуете? [[mood:3]]", "Отлично, это подходит. И чай, пожалуйста. [[mood:4]]", "Спасибо, всё было быстро. Можно счёт? До свидания! [[mood:5]]\n[[end]]"],
  door: ["Да, бронь на Елену, на семь… Мы немного опоздали. [[mood:3]]", "Спасибо! Если можно — подальше от музыки. [[mood:4]]", "Чудесно, благодарю — нас уже ждут за столом. [[mood:5]]\n[[end]]"],
  bar: ["Я за рулём… А без алкоголя что-нибудь праздничное есть? [[mood:3]]", "О, звучит отлично, давайте его. [[mood:4]]", "Очень вкусно, спасибо! Посчитайте, пожалуйста. [[mood:5]]\n[[end]]"],
  manager: ["Второй раз приносят не ту прожарку, а официант ещё и спорит. [[mood:2]]", "Хорошо, если вы сами проследите — подождём. [[mood:3]]", "Спасибо, что разобрались по-человечески. [[mood:4]]\n[[end]]"],
};
const NEW_IDS = new Set(["family", "phone", "leaving", "steak", "bill", "review", "banquet", "refuse"]);
function guestAi(body, mode) {
  const r = guestAi0(body, mode);
  // новый сервер (v42) ставит метку версии; старый — нет
  return r.ok && mode !== "old" && mode !== "bad" ? { ...r, v: 42 } : r;
}
function guestAi0(body, mode) {
  if (mode === "off") return { ok: false, error: "not_configured" };
  // старый сервер не знает новых гостей; прежних — знает (и отвечает без метки версии)
  if (mode === "bad" && NEW_IDS.has(body.guest && body.guest.id)) return { ok: false, error: "bad_guest" };
  const place = (body.guest && body.guest.place) || "hall";
  if (body.finish) {
    const keys = mode === "old" ? KEYS.hall : KEYS[place];
    const scores = Object.fromEntries(keys.map((k, i) => [k, [5, 4, 3, 4, 5][i]]));
    return { ok: true, remaining: 30, reply: "Вот разбор: " + JSON.stringify({ score: 4, scores, good: ["Тёплая встреча без суеты"], fix: ["Стоит повторить бронь вслух"], phrase: "Ваш стол готов — провожу вас.", lessons: [LESSON[place]] }) };
  }
  const mine = (body.messages || []).filter((m) => m.role === "user").length;
  // гость прощается сразу после первой реплики сотрудника (у входа так бывает)
  if (mode === "early") return { ok: true, remaining: 30, reply: "Спасибо, всё понятно — до свидания! [[mood:4]]\n[[end]]" };
  const list = REPLIES[place] || REPLIES.hall;
  return { ok: true, remaining: 30 - mine, reply: list[Math.min(mine - 2, list.length - 1)] || list[0] };
}
async function open({ role = "seasonal", profile = STAFF, light = false, w = 390, h = 844, chat = [], ai = "guest", rpcs = null, storage = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    if (/\/functions\/v1\/ai-chat/.test(u)) {
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      chat.push(body);
      if (body.mode === "guest") { const r = guestAi(body, ai); return route.fulfill({ status: r.error === "bad_guest" ? 400 : 200, contentType: "application/json", body: JSON.stringify(r) }); }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply: "Разберём.", remaining: 18 }) });
    }
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const fn = m[1];
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      if (rpcs) { const r = rpcs(fn, body); if (r !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r) }); }
      const mock = {
        whoami: { ok: true, employee: profile },
        my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: role },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "none" },
        my_mentors: { ok: true, rows: [] }, schedule_load: { ok: false, error: "auth" }, menu_get: [],
      };
      if (mock[fn] !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[fn]) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    }
    return route.abort();
  });
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(profile), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify(role), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_quest_open: "1",
    sa_guest_voice: "0",
    sa_menu_custom: JSON.stringify({ "Два моря, Океан": [{ id: "d1", name: "Борщ с говядиной", allergens: ["сельдерей"] }, { id: "d2", name: "Салат с орехами", allergens: ["орехи"], stop: { since: Date.now() } }] }) };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  const ukx = "_" + profile.name + "_" + (profile.surname || "");
  for (const [k, v] of Object.entries(storage)) seed[k.replace("{uk}", ukx)] = typeof v === "string" ? v : JSON.stringify(v);
  await ctx.addInitScript((seed) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    try { const ss = window.speechSynthesis; if (ss) { ss.speak = (u) => { setTimeout(() => { try { u.onend && u.onend(); } catch (e) {} }, 30); }; ss.cancel = () => {}; } } catch (e) {}
  }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}
const tbText = (page) => page.evaluate(() => { const el = document.querySelector(".tb"); return el ? el.innerText.replace(/\s+/g, " ") : ""; });
const only = process.argv.slice(2);
const want = (tag) => !only.length || only.includes(tag);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
async function openGuest(page) {
  await page.evaluate(() => window.__saNav("shift")); await sleep(1100);
  const card = page.locator('.sa-card[aria-label="Живой гость"]').first();
  const sub = (await card.innerText().catch(() => "")).replace(/\s+/g, " ");
  await card.click(); await sleep(1400);
  return sub;
}
async function say(page, t) { await page.locator(".tb .lg-in").fill(t); await page.locator(".tb .lg-send").click(); await sleep(1100); }
const crit = (page) => page.evaluate(() => [...document.querySelectorAll(".tb .lg-crit li")].map((li) => li.innerText.replace(/\s+/g, " ").replace(/[★☆]+/g, "").trim()));
const roleLine = (page) => page.evaluate(() => { const el = document.querySelector(".tb .lg-role"); return el ? { place: el.getAttribute("data-guest-role"), text: el.innerText.trim() } : null; });
const eyebrow = (page) => page.evaluate(() => { const el = document.querySelector(".tb .lg-card .ey span"); return el ? el.innerText.trim() : ""; });
const ghosts = (page) => page.evaluate(() => [...document.querySelectorAll(".tb .tb-ghost")].map((b) => b.innerText.trim()));
// до гостя нужного вида — «Другой гость» (выбор случайный)
async function until(page, test, max = 24) {
  for (let i = 0; i < max; i++) { if (await test()) return true; await page.locator(".tb .tb-ghost", { hasText: "Другой гость" }).click(); await sleep(250); }
  return !!(await test());
}

// полный разговор: старт → три реплики → конец → чек
async function talk(page, lines) {
  await page.locator(".tb .tb-main").click(); await sleep(600);
  const g = await ghosts(page);
  for (const l of lines) await say(page, l);
  const t = await tbText(page);
  await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).click(); await sleep(1400);
  return { finishLabel: g, ended: t };
}

// ── TILE. Подпись плитки «Живой гость» на «Смене» — по роли ──
if (want("TILE")) {
  for (const [role, profile, re] of [["spg", STAFF, /Гость-ИИ у входа · чек разбора/], ["manager", BOSS, /Гость-ИИ позвал менеджера · чек разбора/], ["bar", STAFF, /Гость-ИИ у барной стойки · чек разбора/], ["seasonal", STAFF, /Гость-ИИ из твоего меню · чек разбора/]]) {
    const { ctx, page, errors } = await open({ role, profile });
    await page.evaluate(() => window.__saNav("shift")); await sleep(1100);
    const sub = (await page.locator('.sa-card[aria-label="Живой гость"]').first().innerText().catch(() => "")).replace(/\s+/g, " ");
    ok("TILE " + role + ": подпись плитки по роли", re.test(sub), sub);
    ok("TILE " + role + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── DOOR. Хостес: гость у входа, без заказа; чек — встреча, бронь, рассадка ──
if (want("DOOR")) {
  const chat = [];
  const { ctx, page, errors } = await open({ role: "spg", chat });
  await openGuest(page);
  // звонок проверяем отдельно (PHONE) — здесь гость у двери
  await until(page, async () => (await eyebrow(page)) === "ВХОД");
  const rl = await roleLine(page);
  ok("DOOR: на карточке — «Ты — хостес…», заказ и аперитив — у официанта", rl && rl.place === "door" && rl.text === "Ты хостес: встреча, бронь, рассадка и передача официанту. Заказ и аперитив — уже работа официанта.", JSON.stringify(rl));
  ok("DOOR: шапка «гость — ИИ · хостес», надпись «ВХОД»", /гость — ИИ · хостес/.test(await tbText(page)) && (await eyebrow(page)) === "ВХОД");
  ok("DOOR: кнопка «Встретить гостя»", (await page.locator(".tb .tb-main").innerText()).trim() === "Встретить гостя");
  await page.locator(".tb .tb-main").click(); await sleep(600);
  const g = await ghosts(page);
  ok("DOOR: в разговоре — «Завершить встречу», без «Рассчитать гостя»", g.includes("Завершить встречу") && !g.includes("Рассчитать гостя"), g.join(" | "));
  await say(page, "Добрый вечер! Рада вас видеть. Подскажите, на какое имя бронь?");
  ok("DOOR: новый сервер — без подсказки про старый ai-chat", (await page.locator(".tb [data-old-ai]").count()) === 0);
  await say(page, "Ничего страшного, стол вас ждёт. Хотите потише, у окна?");
  await say(page, "Провожу вас. Вашим официантом сегодня будет Иван — он сейчас подойдёт.");
  const t = await tbText(page);
  ok("DOOR: конец — «Встреча у входа окончена», не «Гость попросил счёт»", /Встреча у входа окончена/.test(t) && !/попросил счёт/.test(t), t.slice(-160));
  const sent = chat.filter((b) => b.mode === "guest");
  ok("DOOR: в ai-chat уходит трек spg и гость у входа", sent.length >= 3 && sent.every((b) => b.track === "spg" && b.guest && b.guest.place === "door") && sent[0].messages[0].content === "*подходит к гостю*", JSON.stringify(sent.map((b) => [b.track, b.guest && b.guest.id])));
  await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).click(); await sleep(1400);
  const c = await crit(page);
  ok("DOOR: пункты чека — встреча, бронь и ожидание, забота, рассадка и передача, спокойствие", c.join(" | ") === "Встреча | Бронь и ожидание | Забота о госте | Рассадка и передача | Спокойствие", c.join(" | "));
  const rt = await tbText(page);
  ok("DOOR: в чеке нет «Знание меню» и «Рекомендации»; место — «вход»", !/Знание меню|Рекомендации/.test(rt) && /Два моря, Океан · вход/.test(rt), rt.slice(0, 200));
  ok("DOOR: урок на повтор — из трека хостес", /Как принимать и вести бронь/.test(rt), rt.slice(-300));
  await shot(page, "door-receipt");
  const finSent = chat.filter((b) => b.mode === "guest" && b.finish);
  ok("DOOR: чек запрошен с треком spg", finSent.length === 1 && finSent[0].track === "spg");
  ok("DOOR: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── PHONE. Звонок на стойку хостес ──
if (want("PHONE")) {
  const chat = [];
  const { ctx, page, errors } = await open({ role: "spg", chat });
  await openGuest(page);
  const got = await until(page, async () => /ЗВОНОК/.test(await eyebrow(page)), 40);
  ok("PHONE: среди гостей хостес есть звонок на стойку", got);
  if (got) {
    ok("PHONE: «ЗВОНОК НА СТОЙКУ», «Ответить на звонок», роль — принять бронь", (await eyebrow(page)) === "ЗВОНОК НА СТОЙКУ" && (await page.locator(".tb .tb-main").innerText()).trim() === "Ответить на звонок" && /Прими бронь/.test((await roleLine(page) || {}).text || ""));
    ok("PHONE: на рисунке — стойка со звонком", (await page.locator('.tb svg.lg-top[aria-label="Стойка хостес, звонит гость"]').count()) === 1);
    ok("PHONE: на карточке — что свободно в книге броней (видит только хостес)", ((await page.locator(".tb [data-guest-note]").innerText().catch(() => "")) || "").trim() === "В книге броней на субботу свободно только с 20:15.");
    await shot(page, "phone-card");
    await page.locator(".tb .tb-main").click(); await sleep(600);
    ok("PHONE: «Завершить звонок»", (await ghosts(page)).includes("Завершить звонок"));
    await say(page, "Добрый день! Конечно. На сколько человек и на какое время?");
    const b = chat.filter((x) => x.mode === "guest").pop() || {};
    ok("PHONE: первая строка для ИИ — «снимает трубку»", (b.messages || [])[0] && b.messages[0].content === "*снимает трубку на стойке хостес*", JSON.stringify((b.messages || [])[0]));
    await say(page, "На 19:30 всё занято, могу предложить 20:15 — подойдёт?");
    await say(page, "Записала: суббота, 20:15, восемь гостей, стол без ступенек. Ждём вас!");
    ok("PHONE: конец — «Звонок окончен»", /Звонок окончен/.test(await tbText(page)));
    await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).click(); await sleep(1400);
    const c = await crit(page);
    ok("PHONE: пункты чека звонка — начало звонка, бронь, забота, стол и время, спокойствие", c.join(" | ") === "Начало звонка | Бронь | Забота о госте | Стол и время | Спокойствие", c.join(" | "));
    ok("PHONE: место в чеке — «стойка хостес»", /Два моря, Океан · стойка хостес/.test(await tbText(page)));
  }
  ok("PHONE: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── EXIT. Проводы на выходе ──
if (want("EXIT")) {
  const { ctx, page, errors } = await open({ role: "spg" });
  await openGuest(page);
  const got = await until(page, async () => (await eyebrow(page)) === "ВЫХОД", 40);
  ok("EXIT: среди гостей хостес есть проводы на выходе", got);
  if (got) {
    ok("EXIT: «ВЫХОД», «Подойти к гостю», роль — проводить", (await page.locator(".tb .tb-main").innerText()).trim() === "Подойти к гостю" && /^Ты хостес: гость уходит после ужина/.test((await roleLine(page) || {}).text || ""));
    await page.locator(".tb .tb-main").click(); await sleep(600);
    ok("EXIT: «Проводить гостя»", (await ghosts(page)).includes("Проводить гостя"));
    await say(page, "Как вам сегодня у нас? Всё понравилось?");
    await say(page, "Спасибо, что сказали про кондиционер, — передам. Такси вызову, а пальто сейчас принесу.");
    await say(page, "Ваша машина будет через пять минут. Приходите ещё!");
    ok("EXIT: конец — «Гость ушёл, проводы окончены»", /Гость ушёл, проводы окончены/.test(await tbText(page)));
    await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).click(); await sleep(1400);
    const c = await crit(page);
    ok("EXIT: пункты чека проводов — внимание, такси и ожидание, забота, проводы, спокойствие", c.join(" | ") === "Внимание к гостю | Такси и ожидание | Забота о госте | Проводы | Спокойствие", c.join(" | "));
  }
  ok("EXIT: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── EARLY. Гость простился после первой реплики — чек разбора всё равно есть ──
if (want("EARLY")) {
  const { ctx, page, errors } = await open({ role: "spg", ai: "early" });
  await openGuest(page);
  await page.locator(".tb .tb-main").click(); await sleep(600);
  await say(page, "Добрый вечер! Стол готов — провожу вас, официант Иван сейчас подойдёт.");
  const t = await tbText(page);
  ok("EARLY: гость простился после одной реплики — «Получить чек разбора»", /окончен/.test(t) && (await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).count()) === 1, t.slice(-160));
  await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).click(); await sleep(1400);
  ok("EARLY: чек разбора открылся и разговор засчитан", (await page.locator(".tb .tb-receipt").count()) === 1 && (await page.evaluate(() => JSON.parse(localStorage.getItem("sa_guest_runs_Роман_Смирнов") || "[]").length)) === 1);
  ok("EARLY: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── OLD. Сервер до v42 прислал пункты официанта — показываем их, а не пустые звёзды ──
if (want("OLD")) {
  const { ctx, page, errors } = await open({ role: "spg", ai: "old" });
  await openGuest(page);
  await until(page, async () => (await eyebrow(page)) === "ВХОД");
  await page.locator(".tb .tb-main").click(); await sleep(600);
  await say(page, "Добрый вечер!");
  const oldHint = (await page.locator(".tb [data-old-ai]").count()) === 1;
  await say(page, "Стол готов, провожу.");
  await say(page, "Ваш официант — Иван.");
  await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).click(); await sleep(1400);
  const c = await crit(page);
  ok("OLD: на экране разговора была подсказка обновить ai-chat", oldHint, "");
  ok("OLD: старый сервер — пункты официанта с его подписями", c.join(" | ") === "Контакт и встреча | Знание меню | Забота о госте | Рекомендации | Спокойствие", c.join(" | "));
  ok("OLD: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── MGR. Менеджер: гость позвал менеджера ──
if (want("MGR")) {
  const chat = [];
  const { ctx, page, errors } = await open({ role: "manager", profile: BOSS, chat });
  await openGuest(page);
  const ey = await eyebrow(page);
  ok("MGR: «СТОЛ N», роль менеджера, «Подойти к гостю»", /^СТОЛ \d+$/.test(ey) && /^Ты менеджер: гость позвал тебя разобраться/.test((await roleLine(page) || {}).text || "") && (await page.locator(".tb .tb-main").innerText()).trim() === "Подойти к гостю", ey);
  ok("MGR: шапка «гость — ИИ · менеджер»", /гость — ИИ · менеджер/.test(await tbText(page)));
  await shot(page, "manager-card");
  await page.locator(".tb .tb-main").click(); await sleep(600);
  ok("MGR: «Завершить разговор»", (await ghosts(page)).includes("Завершить разговор"));
  await say(page, "Я менеджер, меня зовут Ольга. Вижу, что ситуация неприятная, — давайте разберусь прямо сейчас.");
  await say(page, "Приношу извинения от лица ресторана. Новый стейк приготовят в приоритете, я прослежу сама.");
  await say(page, "А к десерту позвольте угостить вас от заведения.");
  ok("MGR: конец — «Гость прощается, разговор окончен»", /Гость прощается, разговор окончен/.test(await tbText(page)));
  ok("MGR: трек manager", chat.filter((b) => b.mode === "guest").every((b) => b.track === "manager" && b.guest.place === "manager"));
  await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).click(); await sleep(1400);
  const c = await crit(page);
  ok("MGR: пункты — контакт и тон, разбор ситуации, забота, решение, спокойствие", c.join(" | ") === "Контакт и тон | Разбор ситуации | Забота о госте | Решение | Спокойствие", c.join(" | "));
  const rt = await tbText(page);
  ok("MGR: место — «стол N», урок — «Роль менеджера в конфликте»", /Два моря, Океан · стол \d+/.test(rt) && /Роль менеджера в конфликте/.test(rt), rt.slice(0, 160));
  await shot(page, "manager-receipt");
  ok("MGR: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── BAR. Бармен ──
if (want("BAR")) {
  const chat = [];
  const { ctx, page, errors } = await open({ role: "bar", chat });
  await openGuest(page);
  ok("BAR: «БАРНАЯ СТОЙКА», роль бармена", (await eyebrow(page)) === "БАРНАЯ СТОЙКА" && /^Ты бармен/.test((await roleLine(page) || {}).text || ""));
  const r = await talk(page, ["Добрый вечер! Что любите — посвежее или послаще?", "Безалкогольный «Гарден» — с огурцом и лаймом.", "Счёт сейчас принесу."]);
  ok("BAR: «Рассчитать гостя» и «Гость попросил счёт»", r.finishLabel.includes("Рассчитать гостя") && /Гость попросил счёт, разговор окончен/.test(r.ended));
  const c = await crit(page);
  ok("BAR: пункты — контакт у стойки, знание бара, забота и мера, рекомендации, спокойствие", c.join(" | ") === "Контакт у стойки | Знание бара | Забота и мера | Рекомендации | Спокойствие", c.join(" | "));
  ok("BAR: трек bar", chat.filter((b) => b.mode === "guest").every((b) => b.track === "bar"));
  ok("BAR: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── HALL. Официант — как до v42 ──
if (want("HALL")) {
  const chat = [];
  const { ctx, page, errors } = await open({ role: "seasonal", chat });
  await openGuest(page);
  ok("HALL: «СТОЛ N», роль официанта, «Подойти к столу»", /^СТОЛ \d+$/.test(await eyebrow(page)) && /^Ты официант/.test((await roleLine(page) || {}).text || "") && (await page.locator(".tb .tb-main").innerText()).trim() === "Подойти к столу");
  await shot(page, "hall-card");
  const r = await talk(page, ["Добрый вечер! Меня зовут Роман. Подскажу, что у нас быстрое.", "Рекомендую борщ — подадим за 10 минут.", "Счёт сейчас принесу."]);
  ok("HALL: «Рассчитать гостя» и «Гость попросил счёт»", r.finishLabel.includes("Рассчитать гостя") && /Гость попросил счёт, разговор окончен/.test(r.ended));
  const c = await crit(page);
  ok("HALL: пункты официанта как раньше", c.join(" | ") === "Контакт и встреча | Знание меню | Забота о госте | Рекомендации | Спокойствие", c.join(" | "));
  const sent = chat.filter((b) => b.mode === "guest");
  ok("HALL: трек seasonal, меню и стоп-лист уходят как раньше", sent.every((b) => b.track === "seasonal") && (sent[0].guest.menu || []).some((x) => /Борщ/.test(x)) && (sent[0].guest.stop || []).includes("Салат с орехами"));
  ok("HALL: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── BAD. Сервер не знает гостя (ai-chat не обновлён) ──
if (want("BAD")) {
  const { ctx, page, errors } = await open({ role: "manager", profile: BOSS, ai: "bad" });
  await openGuest(page);
  await page.locator(".tb .tb-main").click(); await sleep(500);
  await say(page, "Добрый день, я менеджер.");
  const t = await tbText(page);
  ok("BAD: понятно, что делать — «нужно обновить ai-chat»", /Сервер не знает этого гостя/.test(t) && /нужно обновить ai-chat на сервере/.test(t) && (await page.locator(".tb .tb-ghost", { hasText: "Гость по сценарию" }).count()) === 1, t.slice(-220));
  await page.locator(".tb [data-guest-other]").click(); await sleep(600);
  const rl = await roleLine(page);
  ok("BAD: «Другой гость» — гость как в v41: менеджеру — гость зала", rl && rl.place === "hall" && /^СТОЛ \d+$/.test(await eyebrow(page)), JSON.stringify(rl));
  ok("BAD: режим v41 запомнен на сеанс", (await page.evaluate(() => sessionStorage.getItem("sa_guest_legacy"))) === "1");
  await page.locator(".tb .tb-main").click(); await sleep(500);
  await say(page, "Добрый день! Меня зовут Ольга.");
  const t2 = await tbText(page);
  ok("BAD: прежний гость отвечает; у зала подсказки про старый ai-chat нет", (await page.locator(".tb .lg-g").count()) >= 2 && !/Сервер не знает/.test(t2) && (await page.locator(".tb [data-old-ai]").count()) === 0, t2.slice(-160));
  ok("BAD: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── SCRIPT. Без ИИ — гость по сценарию у входа: «Встреча окончена», а не «Гость рассчитался» ──
async function correctText(page) {
  const info = await page.evaluate(() => {
    const t = (sel) => { const el = document.querySelector(".tb " + sel); return el ? el.innerText.trim() : ""; };
    return { scene: t(".tb-scene p"), claim: t(".tb-claim"), cloze: t(".tb-note.cloze p"), q: t(".tb-q") };
  });
  let s = null;
  if (info.scene) s = ALL_SITS.find(x => x.scene && x.scene.trim() === info.scene);
  else if (info.claim && /правда или миф/i.test(info.claim)) s = ALL_SITS.find(x => x.statement && info.claim.includes(x.statement.replace(/^«|»$/g, "").slice(0, 30)));
  else if (info.cloze) s = ALL_SITS.find(x => x.start && info.cloze.startsWith(x.start.trim().slice(0, 25)));
  if (!s && info.q) { const q = ALL_Q.find(x => x.q && x.q.trim() === info.q); if (q) return q.options[q.correct]; }
  if (!s && info.claim) { const q = ALL_Q.find(x => x.q && info.claim.includes(x.q.trim().slice(0, 40))); if (q) return q.options[q.correct]; }
  if (!s && info.scene) { const q = ALL_Q.find(x => x.q && info.scene.includes(x.q.trim().slice(0, 40))); if (q) return q.options[q.correct]; }
  if (!s) return null;
  const right = s.options[s.correct];
  if ((s.genre || s.type) === "truefalse") return /невер|❌/i.test(right) ? "Миф" : "Правда";
  return right;
}
async function playAll(page, max = 16) {
  for (let i = 0; i < max; i++) {
    if (await page.locator(".tb .tb-receipt").count()) return true;
    const w = await correctText(page);
    const btns = page.locator(".tb .tb-actc, .tb .tb-reply, .tb .tb-chip2, .tb .tb-myth button");
    const n = await btns.count();
    let clicked = false;
    for (let k = 0; k < n && w; k++) { const t = (await btns.nth(k).innerText()).trim().replace(/\s+/g, " "); if (t.startsWith(w.replace(/\s+/g, " ").slice(0, 20)) || (w.length <= 6 && t.startsWith(w))) { await btns.nth(k).click(); clicked = true; break; } }
    if (!clicked && n) { await btns.first().click().catch(() => {}); }
    await sleep(1100);
    const nx = page.locator(".tb .tb-foot .tb-main");
    if (await nx.count()) { await nx.first().click().catch(() => {}); await sleep(600); }
  }
  return !!(await page.locator(".tb .tb-receipt").count());
}
if (want("SCRIPT")) {
  const { ctx, page, errors } = await open({ role: "spg", ai: "off" });
  await openGuest(page);
  await page.locator(".tb .tb-ghost", { hasText: "По сценарию" }).click(); await sleep(1200);
  const t0 = await tbText(page);
  ok("SCRIPT: стол «Живой гость» по сценарию с заданиями трека хостес", /Живой гость/.test(t0) && /1 из 4/i.test(t0), t0.slice(0, 200));
  const done = await playAll(page);
  const t = await tbText(page);
  ok("SCRIPT: у входа — «Встреча окончена», без «Гость рассчитался»", done && /Встреча окончена/.test(t) && !/Гость рассчитался/.test(t), t.slice(0, 220));
  await shot(page, "door-script");
  ok("SCRIPT: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
  // выход из сценария у входа — свои слова
  const r2 = await open({ role: "spg", ai: "off" });
  await openGuest(r2.page);
  await r2.page.locator(".tb .tb-ghost", { hasText: "По сценарию" }).click(); await sleep(1200);
  // спрашивает, только когда ответ уже дан
  await r2.page.locator(".tb .tb-actc, .tb .tb-reply, .tb .tb-chip2, .tb .tb-myth button").first().click(); await sleep(1200);
  await r2.page.locator(".tb .tb-x").first().click(); await sleep(600);
  const t2 = (await r2.page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
  ok("SCRIPT: выход — «Гость уйдёт без помощи», а не «без расчёта»", /Гость уйдёт без помощи\. Можно встретить нового/.test(t2) && !/без расчёта/.test(t2), t2.slice(-200));
  await r2.ctx.close();
}

// ── EDIT. Руководитель на треке менеджера: «Сыграть» своего гостя зала — в роли официанта ──
if (want("EDIT")) {
  const rows = [
    { id: "c-abc123abc123", place: "hall", name: "Пётр", age: 40, mood: 3, who: "Пришёл с коллегами", occasion: "бизнес-ланч", hidden: "Не ест мясо", open: "Добрый день! Что у вас без мяса?", whisper: "Спроси про мясо", tags: ["вегетарианец"] },
    { id: "c-door00000001", place: "door", name: "Нина", age: 30, mood: 3, who: "Без брони", occasion: "свидание", hidden: "Хочет у окна", open: "Здравствуйте! Мест нет?", whisper: "", tags: ["без брони"] },
  ];
  const { ctx, page, errors } = await open({ role: "manager", profile: BOSS, rpcs: (fn) => fn === "guest_personas" ? { ok: true, rows, can_edit: true } : undefined });
  await openGuest(page);
  await sleep(600);
  await page.locator(".tb [data-persona-open]").click(); await sleep(500);
  const plays = await page.locator(".tb-sheet[data-persona-editor] li").evaluateAll((lis) => lis.map((li) => li.innerText.replace(/\s+/g, " ")));
  ok("EDIT: «Сыграть» — у гостя зала (менеджер играет его официантом), не у гостя входа", plays.length === 2 && /Пётр.*Сыграть/.test(plays[0]) && !/Сыграть/.test(plays[1]), plays.join(" || "));
  await page.locator(".tb-sheet[data-persona-editor] li", { hasText: "Пётр" }).locator("button", { hasText: "Сыграть" }).click(); await sleep(600);
  const rl = await roleLine(page);
  ok("EDIT: свой гость зала — роль официанта, «Подойти к столу»", rl && rl.place === "hall" && /^Ты официант/.test(rl.text) && /^СТОЛ \d+$/.test(await eyebrow(page)) && (await page.locator(".tb .lg-card h2").innerText()).trim() === "Пётр", JSON.stringify(rl));
  // новый гость в редакторе у менеджера — по умолчанию «Зал» (у сервера нет места «менеджер»)
  await page.locator(".tb [data-persona-open]").click(); await sleep(400);
  await page.locator(".tb-sheet[data-persona-editor] .tb-main", { hasText: "Добавить гостя" }).click(); await sleep(300);
  const on = await page.locator('.tb-sheet[data-persona-editor] .lg-seg button[aria-checked="true"]').first().innerText();
  ok("EDIT: новый гость в редакторе — «Зал» по умолчанию", on.trim() === "Зал", on);
  ok("EDIT: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── SHOT. Снимки карточек: тёмная 390, светлая 320 ──
if (want("SHOT")) {
  for (const [role, profile, light, w, name] of [["spg", STAFF, false, 390, "door-card-dark-390"], ["spg", STAFF, true, 320, "door-card-light-320"], ["manager", BOSS, true, 320, "manager-card-light-320"], ["seasonal", STAFF, false, 390, "hall-card-dark-390"]]) {
    const { ctx, page, errors } = await open({ role, profile, light, w, h: w === 320 ? 640 : 844 });
    await openGuest(page);
    if (role === "spg") await until(page, async () => (await eyebrow(page)) === "ВХОД");
    // ничего не вылезает за край
    const over = await page.evaluate(() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll(".tb *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > W + 1; }).length; });
    ok("SHOT " + name + ": ничего не выходит за край экрана", over === 0, String(over));
    await shot(page, name);
    ok("SHOT " + name + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length}`);
process.exit(bad ? 1 : 0);
