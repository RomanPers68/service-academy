// e2e v160 (Доп. 485): фото сотрудников везде, где были буквы, и крупно по нажатию. Сайт — демо целиком
// (tools/claude/demo-app/build.mjs: сервер в странице; экран открывает window.__saNav; человек демо меняется в том же окне:
// __demo_who + перезагрузка; __demo_no52 = "1" — сервер без фото; __demo_nopos = "1" — этап 52 прежний, без должности).
// В демо фото стоят у Марии, Веры, Петра, Дарьи, Ильи и Ольги; у Анны, Ксении, Тимура и Романа — нет.
// «Лиги недели» и квеста смены в демо-сервере нет: для этих разделов ответ сервера подставляется в странице.
// Разделы:
//   VIEW   — слой «фото крупно»: с лица лидера в «Команде» открывается круг с именем и «должность · заведение», фото
//            целиком догружается; закрывают крестик, касание мимо фото, Escape и «назад» Telegram; экран под слоем тот же;
//   CHAT   — чат: фото в карточке коллеги со значком «увеличить», крупно; «назад» закрывает фото, а карточка остаётся;
//            личный чат — фото в шапке; «Смена» — лица команды; «Моя статистика» и «Аккаунт» — своё фото;
//   RATING — рейтинг: лицо с номером места в углу, без фото — прежний кружок, колонка одной ширины; строка открывает
//            разбор, там фото крупно; «Сотрудник недели» с фото;
//   LEAGUE — «Лига недели»: лица у своих, у коллег из другого заведения — кружок с номером; фото крупно из строки;
//   QUEST  — квест смены: фото в стопке и в жетонах «Кто в смене», жетон с фото открывает его крупно;
//   SCHED  — «График»: старший в шапке, строка выбранного человека под сеткой с кружком фото;
//   OWNER  — владелец: карточка сотрудника, «Управление данными», «Что дало обучение»;
//   NO52   — сервер без этапа 52: везде буквы, ничего не открывается, рейтинг как раньше;
//   NOPOS  — этап 52 прежний: под фото только заведение там, где экран должность не знает;
//   LOOK   — «Для чтения» и 320 px: слой помещается, ничего не вылезает вбок.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v160.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5600, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v160";
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
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 700) : "")); } };
const browser = await chromium.launch();
const REST = "Два моря, Океан";

async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1300);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    document.querySelectorAll("[data-badge-new] [data-lens-x], [data-shelf-new] button[aria-label='Закрыть']").forEach((x) => x.click());
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
}
async function open({ who = "maria", light = false, width = 390, height = 844, hour = 19, minute = 30, no52 = false, nopos = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n, p]) => { localStorage.clear(); localStorage.setItem("__demo_who", w); if (n) localStorage.setItem("__demo_no52", "1"); if (p) localStorage.setItem("__demo_nopos", "1"); }, [who, no52, nopos]);
  await page.evaluate(([h, m]) => { const real = performance.timeOrigin + performance.now(); const d = new Date();
    localStorage.setItem("__demo_t", JSON.stringify({ off: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).getTime() - real, at: real })); }, [hour, minute]);
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
const switchWho = async (page, errs, who) => { await page.evaluate((w) => { localStorage.setItem("__demo_who", w); localStorage.removeItem("__demo_me"); }, who); await page.reload({ waitUntil: "load" }); await ready(page, errs); };
const nav = async (page, s, ms = 1800) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms);
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await page.waitForTimeout(250); };
const overflowX = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });

// что сейчас открыто крупно (или null)
const view = (page) => page.evaluate(() => { const v = document.querySelector("[data-face-view]"); if (!v) return null;
  const ph = v.querySelector("[data-face-photo]"), r = ph.getBoundingClientRect(), f = v.querySelector("[data-face-full]"), x = v.querySelector("[data-face-x]").getBoundingClientRect();
  const nm = v.querySelector("[data-face-name]"), sb = v.querySelector("[data-face-sub]"), low = (sb || nm).getBoundingClientRect();
  const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const root = document.getElementById("root"); const layers = [...document.body.children].filter((el) => el !== root && el.tagName !== "SCRIPT").reverse();
  const top = layers.find((l) => [...l.querySelectorAll("[data-sa-back], [aria-label='Назад']")].some(vis));
  return { id: v.getAttribute("data-face-view"), name: nm.textContent, sub: sb ? sb.textContent : "", w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(innerWidth - r.right), top: Math.round(r.top),
    state: ph.getAttribute("data-face-photo"), nat: f ? f.naturalWidth : 0, onTop: top === v, x: [Math.round(x.left), Math.round(x.top), Math.round(x.width), Math.round(x.height)], low: Math.round(low.bottom), vw: innerWidth, vh: innerHeight,
    label: v.getAttribute("aria-label"), role: v.getAttribute("role"), op: Number(getComputedStyle(v).opacity), focus: document.activeElement === v.querySelector("[data-face-x]") }; });
const waitView = async (page, full = true) => { await page.waitForSelector("[data-face-view]", { timeout: 4000 }).catch(() => {}); if (full) await page.waitForSelector('[data-face-photo="full"]', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(350); return view(page); };
const closeView = async (page) => { const x = page.locator("[data-face-x]"); if (await x.count()) { await x.click(); await page.waitForTimeout(350); } };
// «назад» Telegram: приложение нажимает первую видимую кнопку [data-sa-back] в верхнем слое (lib/utils.js clickScreenBack)
const tgBack = async (page) => { const what = await page.evaluate(() => { const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const root = document.getElementById("root"); const layers = [...document.body.children].filter((el) => el !== root && el.tagName !== "SCRIPT").reverse(); if (root) layers.push(root);
  const isBackText = (el) => { const t = (el.textContent || "").replace(/\s+/g, " ").trim(); return t === "‹" || t === "‹ Назад" || t === "←" || t === "← Назад"; };
  for (const l of layers) { const m = [...l.querySelectorAll("[data-sa-back], [aria-label='Назад']")].find(vis); if (m) { const w = m.hasAttribute("data-face-x") ? "face" : (m.className || m.getAttribute("aria-label") || m.tagName); m.click(); return String(w); }
    const t = [...l.querySelectorAll("button, [role='button']")].find((el) => isBackText(el) && vis(el)); if (t) { t.click(); return "text"; } } return ""; });
  await page.waitForTimeout(450); return what; };
const faces = (page, sel = "body") => page.evaluate((s) => [...document.querySelectorAll(s + " img[data-face]")].filter((i) => i.getClientRects().length > 0).map((i) => ({ id: i.getAttribute("data-face"), zoom: i.getAttribute("data-face-zoom"), w: Math.round(i.getBoundingClientRect().width),
  role: i.getAttribute("role"), tab: i.getAttribute("tabindex"), label: i.getAttribute("aria-label"), pe: getComputedStyle(i).pointerEvents, round: getComputedStyle(i).borderRadius !== "0px" })), sel);
const openChatPerson = async (page) => { await page.locator("[data-chat-dock]").click(); await page.waitForTimeout(1200);
  await page.locator('[data-chat-item="team"]').first().click(); await page.waitForTimeout(1500);
  await page.locator("[data-chat-who]").first().click(); await page.waitForTimeout(1300); };
// ответ сервера для разделов, которых в демо-сервере нет
const mock = (page, fn, body) => page.evaluate(([f, b]) => { const s = window.__demo.srv, orig = s.rpc.bind(s); s.rpc = (name, arg) => (name === f ? JSON.parse(b) : orig(name, arg)); }, [fn, JSON.stringify(body)]);
const LEAGUE = { ok: true, week_start: "2026-11-09", today: "2026-11-14", restaurant: REST, prev_week: "2026-11-02", verified: true,
  rows: [["e-vera", "Вера", "Соколова", "waiter", 140], ["u-maria", "Мария", "Ким", "manager", 125], ["x-1", "Лев", "Г.", "waiter", 118, "Два моря, Гавань"], ["e-anna", "Анна", "Смирнова", "waiter", 96], ["e-petr", "Пётр", "Орлов", "waiter", 80],
    ["e-ilya", "Илья", "Белов", "bartender", 64], ["e-darya", "Дарья", "Лебедева", "waiter", 40], ["e-olga", "Ольга", "Ли", "hostess", 22], ["e-timur", "Тимур", "Ахметов", "bartender", 12], ["e-ksenia", "Ксения", "Миронова", "waiter", 6], ["x-2", "Нина", "П.", "hostess", 5, "Два моря, Гавань"]]
    .map(([id, name, surname, position, pts, rest], i) => ({ id, name, surname, restaurant: rest || REST, position, pts, days: 3, me: id === "u-maria", prev_rest: i + 1, prev_net: i + 1, prev_pts: pts - 10 })),
  cup: [{ restaurant: REST, people: 9, active: 9, pts: 585, avg: 65, mine: true, prev_rank: 1 }, { restaurant: "Два моря, Гавань", people: 6, active: 2, pts: 123, avg: 20.5, mine: false, prev_rank: 2 }],
  cup_hist: [], me_prev: { pts: 90, rank_rest: 2, rank_net: 2 }, wins: { rest: 1, net: 0 } };
const QUEST = { ok: true, date: "2026-11-14", restaurant: REST, known: true, me_on: true, lead: false, tg: false, thanks: [], complete: false,
  people: [["e-anna", "Анна", "С", "waiter", 2, 1, 0, true], ["u-maria", "Мария", "К", "manager", 3, 1, 1, true], ["e-darya", "Дарья", "Л", "waiter", 1, 1, 0, true], ["e-petr", "Пётр", "О", "waiter", 0, 0, 0, false], ["e-ksenia", "Ксения", "М", "waiter", 1, 0, 0, true]]
    .map(([id, name, initial, position, steps, warm, guest, synced]) => ({ id, name, initial, position, me: id === "e-anna", steps, warm, guest, synced, tg: false, called: false })),
  goal: { warm: 5, steps: 10, guest: 2 }, done: { warm: 3, steps: 7, guest: 1 } };

// ═══ VIEW: слой «фото крупно» ═══════════════════════════════════════════════════════════════════════════
if (want("VIEW")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  await nav(page, "teamHub", 2400);
  const lead = await faces(page, "[data-leader]");
  ok("VIEW: в «Команде» у лидеров фото, открываются касанием", lead.length >= 2 && lead.every((f) => f.zoom === "quiet" && f.pe === "auto" && f.round), lead);
  ok("VIEW: внутри карточки-кнопки лицо не объявляется второй кнопкой", lead.every((f) => f.role === null && f.tab === null && f.label === null), lead);
  const before = await page.evaluate(() => document.getElementById("root").innerText.slice(0, 400));
  await page.locator('[data-leader] img[data-face="e-vera"]').first().click();
  const v = await waitView(page);
  ok("VIEW: нажали на лицо Веры — открылось фото крупно", !!v && v.id === "e-vera", v);
  ok("VIEW: имя и «должность · заведение» под фото", v && v.name === "Вера Соколова" && v.sub === "Официант · " + REST, v);
  ok("VIEW: круг большой: 82% ширины экрана, ровный и по центру", v && v.w >= 310 && v.w <= 330 && Math.abs(v.w - v.h) <= 1 && Math.abs(v.left - v.right) <= 1, v);
  ok("VIEW: фото целиком догрузилось (не превью из кружка)", v && v.state === "full" && v.nat >= 300, v);
  ok("VIEW: слой — диалог с именем, поверх всего, не прозрачный, крестик в фокусе", v && v.role === "dialog" && v.label === "Фото: Вера Соколова" && v.onTop && v.op === 1 && v.focus, v);
  ok("VIEW: крестик 44 px, в правом верхнем углу, на экране", v && v.x[2] === 44 && v.x[3] === 44 && v.x[0] + 44 <= v.vw && v.x[1] >= 0 && v.x[1] < 80, v);
  await shot(page, "view-1-vera");
  const under = await page.evaluate(() => document.getElementById("root").innerText.slice(0, 400));
  ok("VIEW: экран под слоем тот же: рейтинг не открылся", under === before, under.slice(0, 80));
  // фото само не закрывает; мимо фото — закрывает
  await page.locator("[data-face-photo]").click(); await page.waitForTimeout(300);
  ok("VIEW: нажатие на само фото слой не закрывает", !!(await view(page)));
  await page.locator("[data-face-name]").click(); await page.waitForTimeout(300);
  ok("VIEW: нажатие на имя слой не закрывает", !!(await view(page)));
  await page.mouse.click(30, 760); await page.waitForTimeout(400);
  ok("VIEW: нажатие мимо фото закрывает", (await view(page)) === null);
  ok("VIEW: после закрытия экран тот же", (await page.evaluate(() => document.getElementById("root").innerText.slice(0, 400))) === before);
  // крестик
  await page.locator('[data-leader] img[data-face="e-vera"]').first().click(); await waitView(page, false);
  await page.locator("[data-face-x]").click(); await page.waitForTimeout(400);
  ok("VIEW: крестик закрывает", (await view(page)) === null);
  // Escape
  await page.locator('[data-leader] img[data-face="e-vera"]').first().click(); await waitView(page, false);
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  ok("VIEW: Escape закрывает", (await view(page)) === null);
  // «назад» Telegram
  await page.locator('[data-leader] img[data-face="e-vera"]').first().click(); await waitView(page, false);
  const what = await tgBack(page);
  ok("VIEW: «назад» Telegram закрывает фото, а не уходит с экрана", what === "face" && (await view(page)) === null && (await page.evaluate(() => document.getElementById("root").innerText.slice(0, 400))) === before, what);
  // другое лицо — другое фото
  const other = lead.find((f) => f.id !== "e-vera");
  if (other) { await page.locator('[data-leader] img[data-face="' + other.id + '"]').first().click(); const v2 = await waitView(page);
    ok("VIEW: другое лицо — другое фото и имя", v2 && v2.id === other.id && v2.name !== "Вера Соколова" && v2.state === "full", v2); await closeView(page); }
  ok("VIEW: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ CHAT: чат, «Смена», своё фото ══════════════════════════════════════════════════════════════════════
if (want("CHAT")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  await nav(page, "shift", 2400);
  const crew = await faces(page, "[data-shift-mates]");
  ok("CHAT: «Смена» — лица команды открываются касанием", crew.length >= 1 && crew.every((f) => f.zoom === "quiet" && f.pe === "auto"), crew);
  if (crew.length) { const was = await page.evaluate(() => document.getElementById("root").innerText.slice(0, 300));
    await page.locator("[data-shift-mates] img[data-face]").first().click(); const v = await waitView(page);
    ok("CHAT: лицо из «Смены» — крупно, с именем", v && v.id === crew[0].id && v.name.length > 3 && v.state === "full", v); await shot(page, "chat-1-shift-big"); await closeView(page);
    ok("CHAT: карточка смены под фото не сработала: экран тот же", (await page.evaluate(() => document.getElementById("root").innerText.slice(0, 300))) === was); }
  await nav(page, "roleSelect", 1500);
  await openChatPerson(page);
  const card = await page.evaluate(() => { const s = document.querySelector(".ch-sheet[data-chat-person]"); if (!s) return null; const a = s.querySelector("[data-chat-person-face]"), i = a.querySelector("img[data-face]"), hint = a.querySelector("[data-face-hint]");
    return { emp: s.getAttribute("data-chat-person"), name: s.querySelector(".ch-pp-n").textContent, pos: (s.querySelector(".ch-pp-p") || {}).textContent || "", face: i ? i.getAttribute("data-face") : null, zoom: i ? i.getAttribute("data-face-zoom") : null,
      label: i ? i.getAttribute("aria-label") : null, role: i ? i.getAttribute("role") : null, hint: !!hint, hintIn: hint ? (() => { const h = hint.getBoundingClientRect(), r = a.getBoundingClientRect(); return h.right <= r.right + 6 && h.bottom <= r.bottom + 6; })() : false,
      ini: a.querySelector("span[aria-hidden]") ? a.querySelector("span[aria-hidden]").textContent : "" }; });
  ok("CHAT: карточка коллеги — фото вместо букв, значок «увеличить»", card && card.face === card.emp && card.zoom === "" && card.hint && card.hintIn, card);
  ok("CHAT: фото в карточке — кнопка с подписью «Фото крупно: имя»; буквы под фото диктору не читаются", card && card.role === "button" && card.label === "Фото крупно: " + card.name && card.ini.length >= 1, card);
  await shot(page, "chat-2-person");
  await page.locator("[data-chat-person-face] img[data-face-zoom]").click();
  const v = await waitView(page);
  ok("CHAT: из карточки коллеги — крупно, должность из чата", v && card && v.id === card.emp && v.name === card.name && v.sub.startsWith(card.pos.split(" · ")[0]) && v.sub.endsWith(REST) && v.onTop, { v, card });
  await shot(page, "chat-3-person-big");
  const w1 = await tgBack(page);
  ok("CHAT: «назад» закрывает фото, карточка коллеги остаётся", w1 === "face" && (await view(page)) === null && (await page.locator(".ch-sheet[data-chat-person]").count()) === 1, w1);
  // с клавиатуры (Telegram на компьютере): Enter на фото открывает, Escape закрывает только фото, фокус возвращается
  await page.locator("[data-chat-person-face] img[data-face-zoom]").focus(); await page.keyboard.press("Enter");
  const vk = await waitView(page, false);
  await page.keyboard.press("Escape"); await page.waitForTimeout(450);
  const fb = await page.evaluate(() => { const a = document.activeElement; return !!a && a.matches("[data-chat-person-face] img[data-face-zoom]"); });
  ok("CHAT: с клавиатуры: Enter открывает, Escape закрывает только фото, фокус возвращается на него", !!vk && (await view(page)) === null && (await page.locator(".ch-sheet[data-chat-person]").count()) === 1 && fb, { vk: !!vk, fb });
  // личный чат: фото в шапке
  await page.getByText("Написать лично").first().click(); await page.waitForTimeout(1600);
  const head = await faces(page, ".ch-head, .ch-top, [data-chat-thread]");
  const dm = await page.evaluate(() => [...document.querySelectorAll(".ch-ava:not(.team) img[data-face]")].filter((i) => i.getClientRects().length > 0).map((i) => [i.getAttribute("data-face"), i.getAttribute("data-face-zoom")]));
  ok("CHAT: личный чат — фото собеседника в шапке (шапка открывает карточку, фото крупно — там)", dm.length >= 1 && card && dm[0][0] === card.emp && dm[0][1] === null, { dm, head });
  await shot(page, "chat-4-dm");
  ok("CHAT: чат — ошибок нет", errs.length === 0, errs);
  // своё фото: «Моя статистика» и «Аккаунт»
  await page.evaluate(() => { const x = document.querySelector(".ch-x[aria-label='Закрыть чат'], [data-chat-close]"); if (x) x.click(); }); await page.waitForTimeout(500);
  await page.reload({ waitUntil: "load" }); await ready(page, errs);
  await nav(page, "stats", 2400);
  const mine = await faces(page, '[data-lens="disc"]');
  ok("CHAT: «Моя статистика» — своё фото, кнопка «Фото крупно»", mine.length === 1 && mine[0].id === "u-maria" && mine[0].zoom === "" && mine[0].label === "Фото крупно: Мария Ким", mine);
  await page.locator('[data-lens="disc"] img[data-face-zoom]').first().click();
  const vm = await waitView(page);
  ok("CHAT: своё фото крупно: «Мария Ким · Менеджер»", vm && vm.id === "u-maria" && vm.sub === "Менеджер · " + REST, vm); await closeView(page);
  await nav(page, "profile", 2400);
  const acc = await faces(page, "[data-account-avatar]");
  ok("CHAT: «Аккаунт» — своё фото открывается крупно", acc.length === 1 && acc[0].id === "u-maria" && acc[0].zoom === "", acc);
  await page.locator("[data-account-avatar] img[data-face-zoom]").click();
  const va = await waitView(page);
  ok("CHAT: из «Аккаунта» — крупно", va && va.id === "u-maria" && va.sub === "Менеджер · " + REST, va); await shot(page, "chat-5-account-big"); await closeView(page);
  ok("CHAT: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ RATING: лицо с номером места ════════════════════════════════════════════════════════════════════════
if (want("RATING")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  await nav(page, "leaderboard", 2600);
  const rows = await page.evaluate(() => [...document.querySelectorAll("[data-lb-rank]")].map((c) => { const f = c.querySelector("[data-rank-face]"), n = c.querySelector("[data-rank-n]"), img = c.querySelector("img[data-face]"), r = c.getBoundingClientRect(), row = c.parentElement.getBoundingClientRect();
    const nr = n ? n.getBoundingClientRect() : null;
    return { w: Math.round(r.width), face: f ? f.getAttribute("data-rank-face") : null, n: n ? n.textContent : c.textContent.trim(), zoom: img ? img.getAttribute("data-face-zoom") : null, fw: f ? Math.round(f.getBoundingClientRect().width) : 0,
      badgeIn: nr ? nr.right <= row.right && nr.bottom <= row.bottom && nr.left >= row.left : true, bw: nr ? Math.round(nr.width) : 0, bh: nr ? Math.round(nr.height) : 0, fs: n ? getComputedStyle(n).fontSize : "", name: c.parentElement.innerText.split("\n")[1] || "", rowH: Math.round(row.height) }; }));
  ok("RATING: в строках рейтинга есть и лица, и прежние кружки", rows.length >= 3 && rows.some((r) => r.face) && rows.some((r) => !r.face), rows);
  ok("RATING: номера мест идут подряд — и на фото, и в кружках", rows.every((r, i) => r.n === String(i + 1)), rows.map((r) => r.n));
  ok("RATING: колонка места у всех строк одной ширины (38 px), лицо 38 px", rows.every((r) => r.w === 38) && rows.filter((r) => r.face).every((r) => r.fw === 38), rows.map((r) => [r.w, r.fw]));
  ok("RATING: номер на фото — жетон 18 px, цифра 10,5 px, не вылезает из строки", rows.filter((r) => r.face).every((r) => r.bh === 18 && r.bw >= 18 && r.fs === "10.5px" && r.badgeIn), rows.filter((r) => r.face));
  ok("RATING: лицо в строке не перехватывает нажатие (строка открывает разбор)", rows.filter((r) => r.face).every((r) => r.zoom === null));
  ok("RATING: строки с фото не выше строк без фото (89 px, как в v159)", rows.every((r) => r.rowH === 89), rows.map((r) => r.rowH));
  await shot(page, "rating-1-rows");
  const star = await page.evaluate(() => { const c = [...document.querySelectorAll("[data-lens='avatar']")][0]; return c ? { face: (c.querySelector("img[data-face]") || { getAttribute: () => null }).getAttribute("data-face"), crown: !!c.querySelector("[data-face-crown]"), svg: !!c.querySelector("svg") } : null; });
  ok("RATING: «Сотрудник недели» без фото (Анна) — медаль с короной, как была", star && star.face === null && star.svg && !star.crown, star);
  // строка с фото → разбор
  const withFace = rows.findIndex((r) => r.face);
  await page.evaluate((i) => { [...document.querySelectorAll("[data-lb-rank]")][i].parentElement.click(); }, withFace); await page.waitForTimeout(1200);
  const det = await page.evaluate(() => { const d = document.querySelector("[data-lb-face]"); if (!d) return null; const i = d.querySelector("img[data-face]"), h = d.querySelector("[data-face-hint]");
    return { face: i ? i.getAttribute("data-face") : null, zoom: i ? i.getAttribute("data-face-zoom") : null, hint: !!h, w: Math.round(d.getBoundingClientRect().width), label: i ? i.getAttribute("aria-label") : "" }; });
  ok("RATING: разбор человека — фото вместо букв и значок «увеличить»", det && det.face === rows[withFace].face && det.zoom === "" && det.hint && det.w === 44, det);
  await shot(page, "rating-2-detail");
  await page.locator("[data-lb-face] img[data-face-zoom]").click();
  const v = await waitView(page);
  ok("RATING: из разбора — фото крупно с должностью из списка фото", v && det && v.id === det.face && /^(Официант|Бармен|Хостес|Менеджер) · Два моря, Океан$/.test(v.sub) && v.state === "full", v);
  await shot(page, "rating-3-big");
  const w = await tgBack(page);
  ok("RATING: «назад» закрывает фото, разбор остаётся", w === "face" && (await view(page)) === null && (await page.locator("[data-lb-face]").count()) === 1, w);
  // строка без фото → разбор с буквами
  await tgBack(page); await page.waitForTimeout(600);
  const noFace = rows.findIndex((r) => !r.face);
  await page.evaluate((i) => { const c = [...document.querySelectorAll("[data-lb-rank]")][i]; if (c) c.parentElement.click(); }, noFace); await page.waitForTimeout(1200);
  const det2 = await page.evaluate(() => { const d = document.querySelector("[data-lb-face]"); return d ? { img: !!d.querySelector("img[data-face]"), hint: !!d.querySelector("[data-face-hint]"), txt: d.textContent.trim() } : null; });
  ok("RATING: у кого фото нет — в разборе буквы, значка нет", det2 && !det2.img && !det2.hint && /^[А-ЯЁ]{1,2}$/.test(det2.txt), det2);
  ok("RATING: вбок ничего не вылезает", (await overflowX(page)) <= 0);
  ok("RATING: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ LEAGUE: «Лига недели» (ответ сервера подставлен) ════════════════════════════════════════════════════
if (want("LEAGUE")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  await mock(page, "league_week", LEAGUE);
  await nav(page, "league", 2600);
  const read = () => page.evaluate(() => [...document.querySelectorAll("[data-lg-rank]")].map((c) => { const f = c.querySelector("[data-rank-face]"), img = c.querySelector("img[data-face]"), n = c.querySelector("[data-rank-n]");
    return { w: Math.round(c.getBoundingClientRect().width), face: f ? f.getAttribute("data-rank-face") : null, zoom: img ? img.getAttribute("data-face-zoom") : null, n: n ? n.textContent : c.textContent.trim(), row: c.parentElement.innerText.replace(/\n+/g, " | ").slice(0, 60) }; }));
  let rows = await read();
  ok("LEAGUE: в строках своего заведения — лица у тех, у кого есть фото", rows.length >= 8 && rows.filter((r) => r.face).length === 6 && rows.every((r) => r.w === 38), rows);
  ok("LEAGUE: лица те же, что в демо (Вера, Мария, Пётр, Илья, Дарья, Ольга)", ["e-vera", "u-maria", "e-petr", "e-ilya", "e-darya", "e-olga"].every((id) => rows.some((r) => r.face === id)), rows.map((r) => r.face));
  ok("LEAGUE: номера мест подряд", rows.every((r, i) => r.n === String(i + 1)), rows.map((r) => r.n));
  ok("LEAGUE: строка сама ничего не открывает — лицо открывается крупно, кнопкой", rows.filter((r) => r.face).every((r) => r.zoom === ""));
  await page.evaluate(() => { const l = document.querySelector("[role=list][aria-label='Лига недели']"); if (l) l.scrollIntoView({ block: "start" }); }); await page.waitForTimeout(400);
  await shot(page, "league-1-rows");
  await page.locator('[data-rank-face="e-ilya"] img[data-face-zoom]').click();
  const v = await waitView(page);
  ok("LEAGUE: из строки лиги — крупно, должность из строки", v && v.id === "e-ilya" && v.name === "Илья Белов" && v.sub === "Бармен · " + REST && v.state === "full", v);
  await shot(page, "league-2-big"); await closeView(page);
  // вся сеть: у чужих фамилия одной буквой и фото нет
  await page.evaluate(() => { const b = document.querySelectorAll("[role=group][aria-label='Какой рейтинг показать'] button")[1]; if (b) b.click(); }); await page.waitForTimeout(900);
  rows = await read();
  const alien = rows.filter((r) => /Лев Г\.|Нина П\./.test(r.row));
  ok("LEAGUE: вся сеть — коллеги из другого заведения в списке, без фото (фамилия одной буквой)", alien.length === 2 && alien.every((r) => r.face === null && r.w === 38), { alien, n: rows.length });
  await page.evaluate(() => { const l = document.querySelector("[role=list][aria-label='Лига недели']"); if (l) l.scrollIntoView({ block: "start" }); }); await page.waitForTimeout(400);
  await shot(page, "league-3-net");
  ok("LEAGUE: вбок ничего не вылезает", (await overflowX(page)) <= 0);
  ok("LEAGUE: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ QUEST: квест смены (ответ сервера подставлен) ═══════════════════════════════════════════════════════
if (want("QUEST")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await mock(page, "quest_today", QUEST);
  await nav(page, "shift", 2600);
  const stack = await faces(page, ".tg-who .avs");
  ok("QUEST: стопка кружков — с фото, нажатий не ловит (строка раскрывает список)", stack.length >= 2 && stack.every((f) => f.zoom === null && f.pe === "none"), stack);
  await page.evaluate(() => { const b = document.querySelector(".tg-who"); if (b) { b.scrollIntoView({ block: "center" }); b.click(); } }); await page.waitForTimeout(900);
  const chips = await page.evaluate(() => [...document.querySelectorAll("[data-quest-person]")].map((c) => ({ id: c.getAttribute("data-quest-person"), role: c.getAttribute("role"), tab: c.getAttribute("tabindex"), face: !!c.querySelector("img[data-face]"), label: c.getAttribute("aria-label") || "", txt: c.innerText.replace(/\n+/g, " ") })));
  ok("QUEST: жетоны «Кто в смене»: с фото — кнопки, без фото — как были", chips.length === 5 && chips.filter((c) => c.face).length === 3 && chips.every((c) => (c.face ? c.role === "button" && c.tab === "0" : c.role === null && c.tab === null)), chips);
  await shot(page, "quest-1-people");
  await page.locator('[data-quest-person="u-maria"]').click();
  const v = await waitView(page);
  ok("QUEST: жетон с фото открывает его крупно: имя полностью, должность", v && v.id === "u-maria" && v.name === "Мария Ким" && v.sub === "Менеджер · " + REST, v);
  await shot(page, "quest-2-big"); await closeView(page);
  await page.locator('[data-quest-person="e-ksenia"]').click({ force: true }).catch(() => {}); await page.waitForTimeout(400);
  ok("QUEST: жетон без фото ничего не открывает", (await view(page)) === null);
  ok("QUEST: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ SCHED: «График» ═════════════════════════════════════════════════════════════════════════════════════
if (want("SCHED")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await nav(page, "schedule", 2600);
  const hero = await faces(page, "[data-hero-lead-disc]");
  ok("SCHED: старший в шапке — фото, открывается касанием", hero.length === 1 && hero[0].id === "u-maria" && hero[0].zoom === "quiet" && hero[0].role === null, hero);
  await page.locator("[data-hero-lead-disc] img[data-face]").click();
  let v = await waitView(page);
  ok("SCHED: старший крупно: «Старший смены · заведение»", v && v.id === "u-maria" && v.sub === "Старший смены · " + REST, v);
  await shot(page, "sched-1-lead-big"); await closeView(page);
  await page.locator("[data-hero-mates]").first().click(); await page.waitForTimeout(900);
  const cells = await faces(page, "[data-sheet-face]");
  ok("SCHED: кружки в листе дня — с фото, нажатие выбирает человека (фото не перехватывает)", cells.length >= 1 && cells.every((f) => f.zoom === null && f.pe === "none"), cells);
  const cellId = await page.evaluate(() => { const c = [...document.querySelectorAll("[data-sheet-face]")].find((x) => x.querySelector("img[data-face]")); if (!c) return null; c.click(); return c.querySelector("img[data-face]").getAttribute("data-face"); });
  await page.waitForTimeout(700);
  const call = await page.evaluate(() => { const r = document.querySelector("[data-sheet-call]"); if (!r) return null; const chip = r.querySelector("[data-face-chip]"), i = r.querySelector("img[data-face]");
    return { chip: chip ? chip.getAttribute("data-face-chip") : null, w: chip ? Math.round(chip.getBoundingClientRect().width) : 0, zoom: i ? i.getAttribute("data-face-zoom") : null, hint: !!r.querySelector("[data-face-hint]"), txt: r.innerText.replace(/\n+/g, " | "), fits: r.scrollWidth <= r.clientWidth + 1 }; });
  ok("SCHED: строка выбранного человека — кружок 34 px с фото и значком «увеличить»", call && call.chip === cellId && call.w === 34 && call.zoom === "" && call.hint && call.fits, call);
  await shot(page, "sched-2-call-row");
  await page.locator("[data-sheet-call] img[data-face-zoom]").click();
  v = await waitView(page);
  ok("SCHED: из строки — крупно, должность из графика", v && v.id === cellId && / · Два моря, Океан$/.test(v.sub) && v.sub.length > REST.length + 3 && v.onTop, v);
  await shot(page, "sched-3-call-big");
  const w = await tgBack(page);
  ok("SCHED: «назад» закрывает фото, лист дня остаётся", w === "face" && (await view(page)) === null && (await page.locator("[data-day-sheet]").count()) === 1, w);
  ok("SCHED: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}
if (want("SCHED")) {
  // «Сегодня» (блок руководителя): карточка человека → строка под сеткой с кружком фото
  const { ctx, page, errs } = await open({ who: "maria" });
  await nav(page, "schedule", 2600);
  await page.evaluate(() => { const s = document.querySelector("[data-sched-today]"); if (s) { s.scrollIntoView({ block: "start" }); if (s.getAttribute("data-sched-today") === "closed") s.firstElementChild.click(); } }); await page.waitForTimeout(900);
  const today = await page.evaluate(() => [...document.querySelectorAll("[data-today-card]")].map((c) => ({ id: c.getAttribute("data-today-card"), face: (c.querySelector("img[data-face]") || { getAttribute: () => null }).getAttribute("data-face"), zoom: (c.querySelector("img[data-face]") || { getAttribute: () => "-" }).getAttribute("data-face-zoom"), tap: c.getAttribute("role") === "button" || getComputedStyle(c).cursor === "pointer" })));
  ok("SCHED: «Сегодня» — в карточках фото; карточка с фото нажимается, лицо нажатие не перехватывает", today.length >= 2 && today.some((c) => c.face) && today.filter((c) => c.face).every((c) => c.tap && c.zoom === null), today);
  const tid = (today.find((c) => c.face) || {}).id;
  await page.evaluate((id) => { const c = document.querySelector('[data-today-card="' + id + '"]'); if (c) c.click(); }, tid); await page.waitForTimeout(700);
  const trow = await page.evaluate(() => { const r = document.querySelector("[data-today-call]"); if (!r) return null; const chip = r.querySelector("[data-face-chip]");
    return { id: r.getAttribute("data-today-call"), chip: chip ? chip.getAttribute("data-face-chip") : null, hint: !!r.querySelector("[data-face-hint]"), txt: r.innerText.replace(/\n+/g, " | "), fits: r.scrollWidth <= r.clientWidth + 1 }; });
  ok("SCHED: «Сегодня» — строка выбранного человека с кружком фото и значком", trow && trow.id === tid && !!trow.chip && trow.hint && trow.fits, trow);
  await shot(page, "sched-4-today-row");
  if (trow && trow.chip) { await page.locator("[data-today-call] img[data-face-zoom]").click(); const vt = await waitView(page);
    ok("SCHED: из «Сегодня» — фото крупно, должность из графика", vt && vt.id === trow.chip && / · Два моря, Океан$/.test(vt.sub) && vt.state === "full", vt); await closeView(page); }
  // у кого ни телефона, ни фото — карточка, как раньше, не нажимается
  const plain = today.find((c) => !c.face);
  if (plain) { await page.evaluate((id) => { const c = document.querySelector('[data-today-card="' + id + '"]'); if (c) c.click(); }, plain.id); await page.waitForTimeout(500);
    const still = await page.evaluate(() => { const r = document.querySelector("[data-today-call]"); return r ? r.getAttribute("data-today-call") : null; });
    ok("SCHED: «Сегодня» — карточка без телефона и без фото не нажимается, как раньше", !plain.tap && still !== plain.id, { plain, still }); }
  ok("SCHED: «Сегодня» — ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ OWNER: владелец ═════════════════════════════════════════════════════════════════════════════════════
if (want("OWNER")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await nav(page, "team", 2400);
  await page.evaluate(() => { const r = [...document.querySelectorAll("[data-lens-card]")].find((x) => /Вера Соколова/.test(x.textContent || "")); if (r) r.click(); }); await page.waitForTimeout(1300);
  const card = await faces(page, '[data-lens-card] [data-lens="disc"]');
  ok("OWNER: карточка сотрудника — фото, кнопка «Фото крупно»", card.length === 1 && card[0].id === "e-vera" && card[0].zoom === "" && card[0].label === "Фото крупно: Вера Соколова", card);
  await page.locator('[data-lens-card] [data-lens="disc"] img[data-face-zoom]').click();
  let v = await waitView(page);
  ok("OWNER: фото сотрудника крупно, с должностью", v && v.id === "e-vera" && v.sub === "Официант · " + REST, v);
  await shot(page, "owner-1-card-big"); await closeView(page);
  await nav(page, "stats", 2600);
  await page.evaluate(() => { const i = document.querySelector("img[data-face]"); if (i) i.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(500);
  const list = await faces(page);
  ok("OWNER: «Управление данными» — фото в строках; строку тянут пальцем, поэтому лицо нажатий не ловит", list.length >= 3 && list.every((f) => f.zoom === null && f.pe === "none"), list);
  await shot(page, "owner-2-manage");
  await nav(page, "gain", 2600);
  await page.evaluate(() => { const i = document.querySelector("img[data-face]"); if (i) i.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(500);
  const gain = await faces(page, "[data-face-over]");
  ok("OWNER: «Что дало обучение» — фото поверх кружков с буквой, открываются крупно", gain.length >= 2 && gain.every((f) => f.zoom === "" && f.role === "button"), gain);
  await shot(page, "owner-3-gain");
  await page.locator("[data-face-over] img[data-face-zoom]").first().click();
  v = await waitView(page);
  ok("OWNER: из «Что дало обучение» — крупно, имя полностью", v && v.id === gain[0].id && / /.test(v.name) && v.state === "full", v); await closeView(page);
  ok("OWNER: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ NO52: сервер без этапа 52 ═══════════════════════════════════════════════════════════════════════════
if (want("NO52")) {
  const { ctx, page, errs } = await open({ who: "maria", no52: true });
  const any = async () => page.evaluate(() => document.querySelectorAll("img[data-face], [data-face-hint], [data-rank-face], [data-face-chip], [data-face-crown]").length);
  await nav(page, "teamHub", 2200);
  const ini = await page.evaluate(() => [...document.querySelectorAll("[data-leader]")].map((x) => x.innerText.trim().slice(0, 2)));
  ok("NO52: «Команда» — буквы, фото нет", (await any()) === 0 && ini.length >= 2 && ini.every((t) => /^[А-ЯЁ]{2}$/.test(t)), ini);
  await nav(page, "leaderboard", 2400);
  const rows = await page.evaluate(() => [...document.querySelectorAll("[data-lb-rank]")].map((c) => [Math.round(c.getBoundingClientRect().width), c.textContent.trim()]));
  // 29 px — сам кружок с ободком, как в v159 (сверено со сборкой v159: колонка 29, имя с 56-й точки, строка 89)
  ok("NO52: рейтинг как раньше: кружки с номерами, колонка по кружку (29 px)", (await any()) === 0 && rows.length >= 3 && rows.every((r, i) => r[0] === 29 && r[1] === String(i + 1)), rows);
  await page.evaluate(() => { [...document.querySelectorAll("[data-lb-rank]")][0].parentElement.click(); }); await page.waitForTimeout(1000);
  const det = await page.evaluate(() => { const d = document.querySelector("[data-lb-face]"); return d ? d.textContent.trim() : null; });
  ok("NO52: разбор в рейтинге — буквы", (await any()) === 0 && /^[А-ЯЁ]{1,2}$/.test(det || ""), det);
  await page.locator("[data-lb-face]").click(); await page.waitForTimeout(400);
  ok("NO52: нажатие на буквы ничего не открывает", (await view(page)) === null);
  await nav(page, "roleSelect", 1500);
  await openChatPerson(page);
  const ch = await page.evaluate(() => { const a = document.querySelector("[data-chat-person-face]"); return a ? a.textContent.trim() : null; });
  ok("NO52: карточка коллеги в чате — буквы, значка «увеличить» нет", (await any()) === 0 && /^[А-ЯЁ]{1,2}$/.test(ch || ""), ch);
  await shot(page, "no52-1-chat");
  ok("NO52: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ NOPOS: этап 52 прежний, без должности в списке ══════════════════════════════════════════════════════
if (want("NOPOS")) {
  const { ctx, page, errs } = await open({ who: "maria", nopos: true });
  await nav(page, "teamHub", 2200);
  await page.locator('[data-leader] img[data-face="e-vera"]').first().click();
  let v = await waitView(page);
  ok("NOPOS: экран должность не знает, сервер не отдал — под фото только заведение", v && v.id === "e-vera" && v.name === "Вера Соколова" && v.sub === REST, v);
  await shot(page, "nopos-1-hub-big"); await closeView(page);
  await nav(page, "roleSelect", 1500);
  await openChatPerson(page);
  await page.locator("[data-chat-person-face] img[data-face-zoom]").click();
  v = await waitView(page);
  ok("NOPOS: где экран должность знает (чат) — она есть и без обновления сервера", v && / · Два моря, Океан$/.test(v.sub) && v.sub.length > REST.length + 3, v);
  await closeView(page);
  ok("NOPOS: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ LOOK: «Для чтения» и 320 px ═════════════════════════════════════════════════════════════════════════
if (want("LOOK")) {
  for (const [tag, o] of [["lt", { light: true }], ["320", { width: 320, height: 568 }], ["320lt", { width: 320, height: 568, light: true }]]) {
    const { ctx, page, errs } = await open({ who: "maria", ...o });
    await nav(page, "leaderboard", 2400);
    const rows = await page.evaluate(() => [...document.querySelectorAll("[data-lb-rank]")].map((c) => { const n = c.querySelector("[data-rank-n]"), row = c.parentElement.getBoundingClientRect(); const nr = n ? n.getBoundingClientRect() : null;
      const nm = c.parentElement.children[1]; return { w: Math.round(c.getBoundingClientRect().width), face: !!c.querySelector("[data-rank-face]"), in: nr ? nr.right <= row.right && nr.left >= row.left : true,
        ink: n ? getComputedStyle(n).color : getComputedStyle(c.firstElementChild).color, nameW: nm ? Math.round(nm.getBoundingClientRect().width) : 0 }; }));
    ok(`LOOK ${tag}: рейтинг — лица и кружки в одной колонке, имени хватает места`, rows.length >= 3 && rows.every((r) => r.w === 38 && r.in && r.nameW >= 90), rows);
    ok(`LOOK ${tag}: рейтинг вбок не вылезает`, (await overflowX(page)) <= 0);
    await page.evaluate(() => { const r = document.querySelector("[data-lb-rank]"); if (r) r.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(400);
    await shot(page, "look-" + tag + "-1-rating");
    const withFace = rows.findIndex((r) => r.face);
    await page.evaluate((i) => { [...document.querySelectorAll("[data-lb-rank]")][i].parentElement.click(); }, withFace); await page.waitForTimeout(1100);
    await page.locator("[data-lb-face] img[data-face-zoom]").click();
    const v = await waitView(page);
    const side = o.width === 320 ? 262 : 320;
    ok(`LOOK ${tag}: фото крупно помещается: круг ${side} px, имя и подпись на экране, крестик виден`, v && Math.abs(v.w - side) <= 2 && v.top >= 50 && v.low <= v.vh - 8 && v.left >= 8 && v.x[0] + v.x[2] <= v.vw && v.state === "full", v);
    await shot(page, "look-" + tag + "-2-big"); await closeView(page);
    if (tag !== "320lt") {
      await mock(page, "league_week", LEAGUE);
      await nav(page, "league", 2400);
      const lg = await page.evaluate(() => [...document.querySelectorAll("[data-lg-rank]")].map((c) => { const row = c.parentElement, pts = row.lastElementChild.getBoundingClientRect(), rr = row.getBoundingClientRect(); return { w: Math.round(c.getBoundingClientRect().width), in: pts.right <= rr.right + 0.5, h: Math.round(rr.height) }; }));
      ok(`LOOK ${tag}: лига — колонка одной ширины, очки не вылезают`, lg.length >= 8 && lg.every((r) => r.w === 38 && r.in), lg.slice(0, 4));
      ok(`LOOK ${tag}: лига вбок не вылезает`, (await overflowX(page)) <= 0);
      await page.evaluate(() => { const l = document.querySelector("[role=list][aria-label='Лига недели']"); if (l) l.scrollIntoView({ block: "start" }); }); await page.waitForTimeout(400);
      await shot(page, "look-" + tag + "-3-league");
    }
    ok(`LOOK ${tag}: ошибок в странице нет`, errs.length === 0, errs);
    await ctx.close();
  }
}

await browser.close(); server.close();
console.log(`\nитог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
