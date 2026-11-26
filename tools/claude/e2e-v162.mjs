// e2e v162 (Доп. 487): лица на карточках чата, в «Жизни команды», на подиуме лиги и в списке сотрудников; сертификат
// бумажным листом и картинкой; кнопки-линзы на входе и в карте обучения; полоска «Первых шагов».
// Сайт — демо целиком (tools/claude/demo-app/build.mjs: сервер в странице, его состояние переживает смену человека:
// __demo_who + перезагрузка; __demo_no52 = "1" — сервер без фото; __demo_pulse = "1" — тесты сданы на этой неделе).
// В демо фото стоят у Марии, Веры, Петра, Дарьи, Ильи и Ольги; у Анны, Ксении, Тимура и Романа — нет.
// Лиги в демо-сервере нет — её ответ (league_week) подставляется в странице.
// Разделы:
//   CARDS  — «Вся команда» глазами Анны: на корешке карточек о человеке фото (кружок 48 px по центру корешка, значок или
//            число в углу, подпись в пределах корешка); у кого фото нет — прежний корешок; касание по фото открывает его
//            крупно и не открывает меню карточки; «Тоже спасибо» — число в углу растёт; высота карточек не изменилась;
//   FEED   — «Команда» → «Жизнь команды»: кружок 32 px с фото или буквами, значок события в углу, текст не съехал;
//            касание по фото — крупно; «Ещё» раскрывает ленту; у руководителя в строке «Ты» — его фото;
//   PODIUM — «Лига недели»: лица тройки (первое место крупнее), над своими пьедесталами, ничего не наезжает; чужое
//            заведение — буквы; касание — фото крупно с должностью; ни у кого из тройки фото нет — подиум как был;
//   CERT   — «Сертификат»: лист в пределах экрана с равными полями (раньше торчал за края), слова, печать, кнопки-линзы;
//            «Поделиться картинкой» — PNG 1080×1350 файлом (где можно) или просмотр со «Скачать»; «назад» закрывает
//            сначала просмотр; «Поделиться текстом» — строка без «сдал(а)»; 320 px и «Для чтения»;
//   OWNER  — владелец, «Сотрудники»: в строке кружок 38 px с фото или буквами, точка статуса на кружке, строка
//            открывает карточку; ширина имён не пострадала;
//   SMALL  — вход: «Войти» — линза, в поле «Введи код»; карта обучения: «Распечатать» — линза; «Первые шаги»: полоска
//            заполнена слева;
//   NO52   — сервер без этапа 52: корешки, лента, подиум и список сотрудников — как раньше; сертификат работает;
//   LOOK   — «Для чтения» и 320 px: ничего не вылезает вбок, лица на месте.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v162.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5620, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v162";
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
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 900) : "")); } };
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
// ls — что ещё положить в память телефона: до входа (pre, переживает вход) и после входа (post — с перезагрузкой)
async function open({ who = "anna", light = false, width = 390, height = 844, hour = 19, minute = 30, no52 = false, pulse = false, post = null, share = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  // share — на телефоне есть системное «Поделиться» (в том числе файлом): что в него ушло, видно в window.__shared
  if (share) await page.addInitScript(() => { window.__shared = [];
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (d) => !!d && (!d.files || d.files.every((f) => f instanceof File)) });
    Object.defineProperty(navigator, "share", { configurable: true, value: (d) => { window.__shared.push({ text: d.text || "", title: d.title || "", files: (d.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size })) }); return Promise.resolve(); } }); });
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n, p]) => { localStorage.clear(); localStorage.setItem("__demo_who", w); if (n) localStorage.setItem("__demo_no52", "1"); if (p) localStorage.setItem("__demo_pulse", "1"); }, [who, no52, pulse]);
  await page.evaluate(([h, m]) => { const real = performance.timeOrigin + performance.now(); const d = new Date();
    localStorage.setItem("__demo_t", JSON.stringify({ off: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).getTime() - real, at: real })); }, [hour, minute]);
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs);
  if (post) { await page.evaluate((kv) => { for (const k of Object.keys(kv)) localStorage.setItem(k, kv[k]); }, post); await page.reload({ waitUntil: "load" }); await ready(page, errs); }
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
const nav = async (page, s, ms = 1800) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms);
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await page.waitForTimeout(250); };
const overflowX = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });
// кнопка «назад» Telegram — то же, что lib/utils.js clickScreenBack: верхний слой, отметка data-sa-back, потом «‹»
const tgBack = async (page) => { const what = await page.evaluate(() => { const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const isBack = (el) => { const t = (el.textContent || "").replace(/\s+/g, " ").trim(); return t === "‹" || t === "‹ Назад" || t === "←" || t === "← Назад"; };
  const root = document.getElementById("root"); const layers = [...document.body.children].filter((el) => el !== root && el.tagName !== "SCRIPT").reverse(); if (root) layers.push(root);
  for (const l of layers) { const m = [...l.querySelectorAll("[data-sa-back], [aria-label='Назад']")].find(vis);
    if (m) { const w = m.hasAttribute("data-face-x") ? "face" : m.closest("[data-cert-preview]") ? "preview" : "marked"; m.click(); return w; }
    const t = [...l.querySelectorAll("button, [role=button]")].find((el) => isBack(el) && vis(el)); if (t) { t.click(); return "text"; } } return ""; });
  await page.waitForTimeout(500); return what; };
// закрыть чат кнопкой «назад», сколько бы слоёв ни было открыто (лента → список чатов → экран)
const closeChat = async (page) => { for (let i = 0; i < 5 && (await page.locator("[data-chat]").count()); i++) await tgBack(page); return (await page.locator("[data-chat]").count()) === 0; };
const toTeam = async (page) => { await page.locator("[data-chat-dock]").click(); await page.waitForTimeout(1200); await page.locator('[data-chat-item="team"]').first().click(); await page.waitForTimeout(1700); };
const viewer = (page) => page.evaluate(() => { const v = document.querySelector("[data-face-view]"); if (!v) return null; const n = v.querySelector("[data-face-name]"), s = v.querySelector("[data-face-sub]");
  return { id: v.getAttribute("data-face-view"), name: n ? n.textContent.trim() : "", sub: s ? s.textContent.trim() : "" }; });
const screenName = (page) => page.evaluate(() => (window.__saScreen ? window.__saScreen() : ""));

// карточки ленты о людях: вид корешка и размеры
const cards = (page) => page.evaluate(() => [...document.querySelectorAll(".ch-row[data-chat-msg]")].map((r) => { const c = r.querySelector("[data-chat-card]"); if (!c) return null;
  const kind = c.getAttribute("data-chat-card"); if (!/^(hello|solo|thx|bday|anniv)$/.test(kind)) return null;
  const stub = c.querySelector(".ch-card-tile"), sr = stub.getBoundingClientRect(), tl = stub.querySelector(".ch-tl"), ft = stub.querySelector("[data-chat-card-face]");
  const face = stub.querySelector(".ch-tl-face"), fr = face ? face.getBoundingClientRect() : null, img = stub.querySelector("img[data-face]"), cap = stub.querySelector(".ch-tl-f i, .ch-tl-i i, .ch-tl-d i"), cr = cap ? cap.getBoundingClientRect() : null;
  const bd = stub.querySelector(".ch-tl-fb"), br = bd ? bd.getBoundingClientRect() : null, t = c.querySelector(".ch-card-t");
  return { id: r.getAttribute("data-chat-msg"), kind, title: t ? t.textContent.trim() : "", h: Math.round(c.getBoundingClientRect().height), cls: tl ? tl.className : "", emp: ft ? ft.getAttribute("data-chat-card-face") : "",
    stub: { l: Math.round(sr.left), r: Math.round(sr.right), w: Math.round(sr.width) },
    face: fr ? { w: Math.round(fr.width), h: Math.round(fr.height), cx: Math.round(fr.left + fr.width / 2), round: getComputedStyle(face).borderRadius === "50%" } : null,
    img: img ? { ok: img.complete && img.naturalWidth > 0, zoom: img.getAttribute("data-face-zoom"), cover: getComputedStyle(img).objectFit } : null,
    cap: cap ? { txt: cap.textContent.trim(), l: Math.round(cr.left), r: Math.round(cr.right), fs: parseFloat(getComputedStyle(cap).fontSize), top: Math.round(cr.top) } : null,
    badge: br ? { w: Math.round(br.width), h: Math.round(br.height), l: Math.round(br.left), r: Math.round(br.right), num: bd.classList.contains("num") ? bd.textContent.trim() : "", svg: !!bd.querySelector("svg") } : null,
    faceBottom: fr ? Math.round(fr.bottom) : null, big: stub.querySelector(".ch-tl-d b") ? stub.querySelector(".ch-tl-d b").textContent.trim() : "" }; }).filter(Boolean));

// ═══ CARDS: карточки чата о человеке ════════════════════════════════════════════════════════════════════
let cardHeights = null;   // высоты карточек с лицами — раздел NO52 сравнит их с прежними
if (want("CARDS") || want("NO52")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await toTeam(page);
  const list = await cards(page);
  cardHeights = Object.fromEntries(list.map((c) => [c.id, c.h]));
  if (want("CARDS")) {
    const withFace = list.filter((c) => c.emp), plain = list.filter((c) => !c.emp);
    ok("CARDS: в ленте есть карточки о людях всех видов из демо", ["hello", "thx", "anniv", "bday"].every((k) => list.some((c) => c.kind === k)), list.map((c) => c.kind + ":" + c.title));
    ok("CARDS: у кого фото есть — на корешке лицо (Пётр, Ольга, Илья, Вера)", withFace.length >= 5 && withFace.every((c) => c.img && c.img.ok && c.cls === "ch-tl ch-tl-f"), withFace.map((c) => [c.kind, c.title, c.emp, c.img]));
    ok("CARDS: фото — круг 48 px по центру корешка, заполнен целиком", withFace.every((c) => c.face.w === 48 && c.face.h === 48 && c.face.round && Math.abs(c.face.cx - (c.stub.l + c.stub.r) / 2) <= 1 && c.img.cover === "cover"), withFace.map((c) => [c.face, c.stub]));
    ok("CARDS: подпись под фото — не мельче 10.5 px и целиком в корешке", withFace.every((c) => c.cap && c.cap.fs >= 10.5 && c.cap.l >= c.stub.l + 1 && c.cap.r <= c.stub.r - 1 && c.cap.top >= c.faceBottom + 4), withFace.map((c) => [c.cap, c.stub, c.faceBottom]));
    ok("CARDS: значок в углу кружка — 20 px, из корешка не выходит", withFace.filter((c) => c.badge).length >= 5 && withFace.filter((c) => c.badge).every((c) => c.badge.h === 20 && c.badge.w >= 20 && c.badge.r <= c.stub.r && c.badge.l > c.face.cx), withFace.map((c) => c.badge));
    const anniv = list.find((c) => c.kind === "anniv"), bday = list.find((c) => c.kind === "bday");
    ok("CARDS: годовщина Веры — её фото, «1 год», звезда в углу", anniv && /^e-/.test(anniv.emp) && anniv.cap.txt === "1год" && anniv.badge && anniv.badge.svg && !anniv.badge.num, anniv);
    ok("CARDS: день рождения Ильи — его фото, «праздник», подарок в углу", bday && bday.emp && bday.cap.txt === "праздник" && bday.badge && bday.badge.svg, bday);
    const two = list.find((c) => c.kind === "thx" && c.badge && c.badge.num);
    ok("CARDS: «2 спасибо» у человека с фото — число в углу кружка, подпись словом", two && two.badge.num === "2" && !two.badge.svg && two.cap.txt === "спасибо", list.filter((c) => c.kind === "thx").map((c) => [c.title, c.badge, c.cap]));
    const mine = list.find((c) => c.kind === "thx" && c.title === "Анна Смирнова");
    ok("CARDS: «спасибо» Анне (фото нет) — прежний корешок с числом и словом", mine && !mine.emp && mine.cls === "ch-tl ch-tl-d" && mine.big === "3" && mine.cap.txt === "спасибо", mine);
    const hello = list.filter((c) => c.kind === "hello");
    ok("CARDS: «Знакомьтесь» у новичков без фото — прежний корешок «новичок»", hello.length >= 1 && hello.every((c) => !c.emp && c.cls === "ch-tl ch-tl-i" && c.cap.txt === "новичок"), hello);
    ok("CARDS: у карточек без лица ничего нового нет", plain.every((c) => !c.face && !c.img && !c.badge), plain);
    // касание по фото: крупно, меню карточки не открывается
    await page.evaluate((id) => { const r = document.querySelector('.ch-row[data-chat-msg="' + id + '"]'); r.scrollIntoView({ block: "center" }); }, anniv.id); await page.waitForTimeout(400);
    await page.locator('.ch-row[data-chat-msg="' + anniv.id + '"] img[data-face]').click(); await page.waitForTimeout(900);
    const v1 = await viewer(page);
    ok("CARDS: касание по фото на корешке — фото Веры крупно", v1 && /^Вера/.test(v1.name), v1);
    ok("CARDS: меню карточки при этом не открылось", (await page.locator(".ch-sheet").count()) === 0);
    await shot(page, "cards-view");
    ok("CARDS: «назад» закрывает фото, чат остаётся", (await tgBack(page)) === "face" && !(await viewer(page)) && (await page.locator(".ch-feed").count()) === 1);
    // корешок скрыт от диктора целиком, фото в обход по клавишам не встаёт
    const a11y = await page.evaluate((id) => { const im = document.querySelector('.ch-row[data-chat-msg="' + id + '"] img[data-face]'); return { hidden: !!im.closest('[aria-hidden="true"]'), tab: im.getAttribute("tabindex"), role: im.getAttribute("role") }; }, anniv.id);
    ok("CARDS: корешок с фото скрыт от диктора, фото не кнопка и не в обходе", a11y.hidden && a11y.tab === null && a11y.role === null, a11y);
    // нажатие мимо фото (на заголовок карточки) — меню, как раньше
    await page.locator('.ch-row[data-chat-msg="' + anniv.id + '"] .ch-card-t').click(); await page.waitForTimeout(700);
    ok("CARDS: нажатие на саму карточку по-прежнему открывает её меню", (await page.locator(".ch-sheet").count()) === 1);
    await page.keyboard.press("Escape"); await page.waitForTimeout(500);
    if (await page.locator(".ch-sheet").count()) { await page.mouse.click(195, 90); await page.waitForTimeout(500); }
    // «Тоже спасибо» на карточке с фото: в углу появляется число
    const one = list.find((c) => c.kind === "thx" && c.emp && c.badge && !c.badge.num && c.title !== "Анна Смирнова");
    const btn = one ? page.locator('.ch-row[data-chat-msg="' + one.id + '"] [data-chat-plus]') : null;
    if (btn && await btn.count()) {
      await page.evaluate((id) => document.querySelector('.ch-row[data-chat-msg="' + id + '"]').scrollIntoView({ block: "center" }), one.id); await page.waitForTimeout(350);
      await btn.click(); await page.waitForTimeout(1300);
      const after = (await cards(page)).find((c) => c.id === one.id);
      ok("CARDS: «Тоже спасибо» — в углу кружка теперь «2», подпись «спасибо», фото на месте", after && after.badge && after.badge.num === "2" && after.cap.txt === "спасибо" && after.img && after.img.ok, after);
    } else ok("CARDS: в демо есть «спасибо» человеку с фото, где можно сказать «Тоже спасибо»", false, list.filter((c) => c.kind === "thx").map((c) => [c.title, c.emp, c.badge]));
    await page.evaluate((id) => document.querySelector('.ch-row[data-chat-msg="' + id + '"]').scrollIntoView({ block: "center" }), anniv.id); await page.waitForTimeout(400);
    await shot(page, "cards-dark");
    ok("CARDS: лента не вылезает вбок", (await overflowX(page)) <= 0);
    ok("CARDS: ошибок в странице нет", errs.length === 0, errs);
  }
  await ctx.close();
}

// ═══ FEED: «Жизнь команды» ══════════════════════════════════════════════════════════════════════════════
const feedRows = (page) => page.evaluate(() => { const f = document.querySelector("[data-team-feed]"); if (!f) return null; const fr = f.getBoundingClientRect();
  return { l: Math.round(fr.left), r: Math.round(fr.right), more: f.querySelector("[data-feed-more]") ? f.querySelector("[data-feed-more]").textContent.trim() : "",
    rows: [...f.querySelectorAll("[data-feed-item]")].map((r) => { const d = r.querySelector("[data-lens='disc']"), dr = d.getBoundingClientRect(), img = d.querySelector("img[data-face]"), k = d.querySelector("[data-feed-kind]"), kr = k ? k.getBoundingClientRect() : null;
      const txt = r.children[1], tr = txt.getBoundingClientRect(), when = r.children[2], wr = when.getBoundingClientRect(), rr = r.getBoundingClientRect();
      const own = [...d.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
      return { kind: r.getAttribute("data-feed-item"), face: d.hasAttribute("data-feed-face"), w: Math.round(dr.width), h: Math.round(dr.height), round: getComputedStyle(d).borderRadius === "50%", letters: own,
        img: img ? { ok: img.complete && img.naturalWidth > 0, id: img.getAttribute("data-face"), zoom: img.getAttribute("data-face-zoom") } : null,
        badge: kr ? { w: Math.round(kr.width), h: Math.round(kr.height), in: kr.right <= rr.right && kr.bottom <= rr.bottom + 1, svg: k.querySelector("svg") ? Math.round(k.querySelector("svg").getBoundingClientRect().width) : 0 } : null,
        text: txt.textContent.trim(), gap: Math.round(tr.left - dr.right), textR: Math.round(tr.right), whenL: Math.round(wr.left), whenR: Math.round(wr.right), rowR: Math.round(rr.right), hidden: d.getAttribute("aria-hidden") }; }) }; });
if (want("FEED")) {
  const { ctx, page, errs } = await open({ who: "anna", pulse: true });
  await nav(page, "teamHub", 2600);
  await page.evaluate(() => { const f = document.querySelector("[data-team-feed]"); if (f) f.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(1200);   // карточка въезжает с масштабом — меряем после
  const f = await feedRows(page);
  ok("FEED: «Жизнь команды» на вкладке «Команда» есть, три строки и «Ещё»", f && f.rows.length === 3 && /^Ещё \d+ ›$/.test(f.more), f && [f.rows.length, f.more]);
  ok("FEED: в каждой строке — кружок с лицом (32 px и ободок), круглый, скрыт от диктора", f.rows.every((r) => r.face && r.w === 34 && r.h === 34 && r.round && r.hidden === "true"), f.rows.map((r) => [r.w, r.h, r.face]));
  const withImg = f.rows.filter((r) => r.img), mine = f.rows.find((r) => /^Ты /.test(r.text));
  ok("FEED: у коллег с фото — фото, оно открывается касанием", withImg.length >= 2 && withImg.every((r) => r.img.ok && r.img.zoom === "quiet"), f.rows.map((r) => [r.text.slice(0, 16), r.img]));
  ok("FEED: в строке «Ты» у Анны (фото нет) — её буквы", mine && !mine.img && mine.letters === "АС", mine);
  ok("FEED: буквы под фото — того же человека, что в тексте строки", f.rows.every((r) => r.letters.length === 2 && (/^Ты /.test(r.text) || r.text[0] === r.letters[0])), f.rows.map((r) => [r.letters, r.text.slice(0, 12)]));
  ok("FEED: значок события — в углу кружка, 16 px, значок внутри 10 px, из строки не выходит", f.rows.every((r) => r.badge && r.badge.w === 16 && r.badge.h === 16 && r.badge.in && r.badge.svg === 10), f.rows.map((r) => r.badge));
  ok("FEED: текст — в 10 px от кружка, время справа не задевает", f.rows.every((r) => r.gap === 10 && r.textR <= r.whenL && r.whenR <= r.rowR + 1), f.rows.map((r) => [r.gap, r.textR, r.whenL, r.whenR, r.rowR]));
  await shot(page, "feed-dark");
  await page.locator("[data-team-feed] img[data-face]").first().click(); await page.waitForTimeout(900);
  const v = await viewer(page), firstFace = f.rows.find((r) => r.img);
  ok("FEED: касание по фото — оно крупно, с именем", v && v.id === firstFace.img.id && v.name.split(" ")[0] === firstFace.text.split(" ")[0], [v, firstFace.text]);
  ok("FEED: «назад» закрывает фото, вкладка на месте", (await tgBack(page)) === "face" && !(await viewer(page)) && (await page.locator("[data-team-feed]").count()) === 1);
  await page.locator("[data-feed-more]").click(); await page.waitForTimeout(1000);
  const all = await feedRows(page);
  ok("FEED: «Ещё» раскрывает ленту — у всех строк кружки с лицами", all.rows.length > 3 && all.rows.every((r) => r.face && r.w === 34) && all.more === "Свернуть", [all.rows.length, all.more, all.rows.map((r) => r.w)]);
  ok("FEED: вкладка не вылезает вбок", (await overflowX(page)) <= 0);
  ok("FEED: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
  // руководитель видит ту же ленту: у троих фото, Анна (для него — «Анна С.») буквами
  const m = await open({ who: "maria", pulse: true });
  await nav(m.page, "teamHub", 2600);
  await m.page.evaluate(() => { const b = document.querySelector("[data-feed-more]"); if (b) b.click(); }); await m.page.waitForTimeout(1200);
  const mf = await feedRows(m.page), an = mf && mf.rows.find((r) => /^Анна С\. /.test(r.text));
  ok("FEED: у руководителя та же лента с лицами: у Анны буквы «АС», у остальных фото", mf && mf.rows.length >= 4 && an && !an.img && an.letters === "АС" && mf.rows.filter((r) => r.img && r.img.ok).length === mf.rows.length - 1, mf && mf.rows.map((r) => [r.text.slice(0, 14), r.letters, r.img && r.img.id]));
  ok("FEED: у руководителя ошибок нет", m.errs.length === 0, m.errs);
  await m.ctx.close();
}

// ═══ PODIUM: «Лига недели» ══════════════════════════════════════════════════════════════════════════════
const mock = (page, fn, body) => page.evaluate(([f, b]) => { const s = window.__demo.srv, orig = s.__rpc0 || s.rpc.bind(s); s.__rpc0 = orig; const map = (s.__mock = s.__mock || {}); map[f] = b;
  s.rpc = (name, arg) => (name in map ? JSON.parse(map[name]) : orig(name, arg)); }, [fn, JSON.stringify(body)]);
const league = (rows, extraRest = []) => ({ ok: true, week_start: "2026-11-09", today: "2026-11-15", restaurant: REST, prev_week: "2026-11-02", verified: true,
  rows: rows.map(([id, name, surname, position, pts, rest], i) => ({ id, name, surname, restaurant: rest || REST, position, pts, days: 3, me: id === "e-anna", prev_rest: i + 1, prev_net: i + 1, prev_pts: Math.max(0, pts - 10) })),
  cup: [{ restaurant: REST, people: 9, active: 9, pts: 600, avg: 66.7, mine: true, prev_rank: 1 }, ...extraRest.map((r) => ({ restaurant: r, people: 6, active: 2, pts: 123, avg: 20.5, mine: false, prev_rank: 2 }))],
  cup_hist: [], me_prev: { pts: 90, rank_rest: 4, rank_net: 5 }, wins: { rest: 0, net: 0 } });
const TAIL = [["e-ilya", "Илья", "Белов", "bartender", 64], ["e-darya", "Дарья", "Лебедева", "waiter", 40], ["e-olga", "Ольга", "Ли", "hostess", 22]];
const podium = (page) => page.evaluate(() => { const g = document.querySelector("[role=group][aria-label='Подиум недели']"); if (!g) return null; const gr = g.getBoundingClientRect();
  const prev = g.previousElementSibling ? g.previousElementSibling.getBoundingClientRect() : null;
  return { l: Math.round(gr.left), r: Math.round(gr.right), top: Math.round(gr.top), prevBottom: prev ? Math.round(prev.bottom) : null, vw: innerWidth,
    cols: [...g.children].map((c) => { const f = c.querySelector("[data-lg-pod-face]"), fr = f ? f.getBoundingClientRect() : null, img = f ? f.querySelector("img[data-face]") : null, ped = c.lastElementChild.getBoundingClientRect();
      const texts = [...c.children].filter((x) => x !== f && x !== c.lastElementChild), first = texts[0] ? texts[0].getBoundingClientRect() : null;
      const own = f ? [...f.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim() : "";
      return { place: c.lastElementChild.textContent.trim(), name: texts.map((x) => x.textContent.trim()).join(" | "), face: fr ? { w: Math.round(fr.width), h: Math.round(fr.height), cx: Math.round(fr.left + fr.width / 2), top: Math.round(fr.top), bottom: Math.round(fr.bottom), round: getComputedStyle(f).borderRadius === "50%", hidden: f.getAttribute("aria-hidden") } : null,
        letters: own, img: img ? { ok: img.complete && img.naturalWidth > 0, id: img.getAttribute("data-face"), zoom: img.getAttribute("data-face-zoom") } : null,
        pedCx: Math.round(ped.left + ped.width / 2), pedTop: Math.round(ped.top), textTop: first ? Math.round(first.top) : null }; }) }; });
if (want("PODIUM")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await mock(page, "league_week", league([["e-vera", "Вера", "Соколова", "waiter", 140], ["u-maria", "Мария", "Ким", "manager", 125], ["e-anna", "Анна", "Смирнова", "waiter", 96], ["e-petr", "Пётр", "Орлов", "waiter", 80], ...TAIL]));
  await nav(page, "league", 2800);
  await page.evaluate(() => { const p = document.querySelector("[role=group][aria-label='Подиум недели']"); if (p) p.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(500);
  const p = await podium(page);
  ok("PODIUM: подиум из трёх мест, у каждого — кружок с лицом", p && p.cols.length === 3 && p.cols.every((c) => c.face && c.face.round && c.face.hidden === "true"), p && p.cols.map((c) => [c.place, c.name, c.face]));
  const by = (n) => p.cols.find((c) => c.place === String(n));
  ok("PODIUM: первое место крупнее (58 px), второе и третье — 46 px", by(1).face.w === 58 && by(1).face.h === 58 && by(2).face.w === 46 && by(3).face.w === 46, p.cols.map((c) => [c.place, c.face.w]));
  ok("PODIUM: у Веры и Марии — фото; у Анны (фото нет) — буквы «АС»", by(1).img && by(1).img.ok && by(2).img && by(2).img.id === "u-maria" && !by(3).img && by(3).letters === "АС", p.cols.map((c) => [c.place, c.letters, c.img]));
  ok("PODIUM: лицо стоит над своим пьедесталом, имя — под лицом", p.cols.every((c) => Math.abs(c.face.cx - c.pedCx) <= 1 && c.textTop >= c.face.bottom + 4 && c.pedTop > c.textTop), p.cols.map((c) => [c.face.cx, c.pedCx, c.face.bottom, c.textTop, c.pedTop]));
  ok("PODIUM: победитель выше остальных; карточку над подиумом лица не задевают", by(1).face.top < by(2).face.top && by(1).face.top < by(3).face.top && (p.prevBottom == null || by(1).face.top - p.prevBottom >= 10) && p.l >= 0 && p.r <= p.vw, [p.prevBottom, p.cols.map((c) => c.face.top)]);
  await shot(page, "podium-dark");
  await page.locator("[data-lg-pod-face] img[data-face]").first().click(); await page.waitForTimeout(900);
  const v = await viewer(page);
  ok("PODIUM: касание по фото на подиуме — фото крупно, с именем и должностью", v && /^(Мария Ким|Вера Соколова)$/.test(v.name) && /менеджер|официант/i.test(v.sub), v);
  ok("PODIUM: «назад» закрывает фото, лига на месте", (await tgBack(page)) === "face" && !(await viewer(page)) && !!(await podium(page)));
  // вся сеть: коллега другого заведения — буквами. v199 (Доп. 524): у сотрудника лига только своего заведения — коллеги
  // из другого на подиуме больше нет, и переключателя «во всей сети» тоже
  await mock(page, "league_week", league([["e-vera", "Вера", "Соколова", "waiter", 140], ["x-1", "Лев", "Г.", "waiter", 131, "Два моря, Гавань"], ["u-maria", "Мария", "Ким", "manager", 125], ["e-anna", "Анна", "Смирнова", "waiter", 96], ...TAIL], ["Два моря, Гавань"]));
  await nav(page, "home", 900); await nav(page, "league", 2800);
  await page.evaluate(() => { const b = document.querySelectorAll("[role=group][aria-label='Какой рейтинг показать'] button")[1]; if (b) b.click(); }); await page.waitForTimeout(1000);
  await page.evaluate(() => { const p = document.querySelector("[role=group][aria-label='Подиум недели']"); if (p) p.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(500);
  const n = await podium(page), lev = n && n.cols.find((c) => /Лев/.test(c.name));
  ok("PODIUM: у Анны лига только своего заведения — коллеги из другого заведения на подиуме нет", !!n && !lev && n.cols.length === 3
    && (await page.locator("[role=group][aria-label='Какой рейтинг показать']").count()) === 0, n && n.cols.map((c) => [c.name, c.letters, !!c.img]));
  await shot(page, "podium-net");
  // ни у кого из тройки фото нет — подиум как был
  await mock(page, "league_week", league([["e-anna", "Анна", "Смирнова", "waiter", 140], ["e-ksenia", "Ксения", "Миронова", "waiter", 125], ["e-timur", "Тимур", "Ахметов", "bartender", 96], ["e-vera", "Вера", "Соколова", "waiter", 80], ...TAIL]));
  await nav(page, "home", 900); await nav(page, "league", 2800);
  const none = await podium(page);
  ok("PODIUM: ни у кого из тройки фото нет — кружков на подиуме нет, как раньше", none && none.cols.length === 3 && none.cols.every((c) => !c.face) && (await page.locator("[data-rank-face]").count()) >= 1, none && none.cols.map((c) => [c.name, !!c.face]));
  ok("PODIUM: лига не вылезает вбок", (await overflowX(page)) <= 0);
  ok("PODIUM: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ CERT: сертификат ═══════════════════════════════════════════════════════════════════════════════════
const EXAM = { "sa_exam_Анна_Смирнова": JSON.stringify({ seasonal: { passed: true, score: 92, correct: 23, total: 25, date: "2026-11-12T03:00:00.000Z" } }) };
const certOpen = async (page) => { await nav(page, "certificates", 2200); await page.getByText("Открыть сертификат").first().click(); await page.waitForTimeout(1700); };
const cert = (page) => page.evaluate(() => { const c = document.querySelector("[data-cert]"); if (!c) return null; const r = c.getBoundingClientRect(), q = (s) => { const e = c.querySelector(s); return e ? e.textContent.trim() : null; };
  const seal = c.querySelector("[data-now-seal]"), sr = seal ? seal.getBoundingClientRect() : null, btn = (s) => { const b = document.querySelector(s); if (!b) return null; const br = b.getBoundingClientRect(), cs = getComputedStyle(b);
    return { text: b.textContent.trim(), l: Math.round(br.left), r: Math.round(br.right), h: Math.round(br.height), bg: cs.backgroundColor, img: cs.backgroundImage.slice(0, 40), color: cs.color, lens: b.getAttribute("data-lens-btn") }; };
  return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), vw: innerWidth, bg: getComputedStyle(c).backgroundImage.slice(0, 60),
    name: q("[data-cert-name]"), role: q("[data-cert-role]"), done: q("[data-cert-done]"), date: q("[data-cert-date]"), until: q("[data-cert-until]"), text: c.innerText.replace(/\s+/g, " "),
    seal: sr ? { w: Math.round(sr.width), in: sr.right <= r.right - 12 && sr.bottom <= r.bottom - 12, cap: !!seal.querySelector("svg path[d^='M12 4L2.5 9']") } : null,
    nameFs: parseFloat(getComputedStyle(c.querySelector("[data-cert-name]")).fontSize), pic: btn("[data-cert-sharepic]"), txt: btn("[data-cert-sharetext]"), done2: btn("[data-cert-done-btn]") }; });
if (want("CERT")) {
  const { ctx, page, errs } = await open({ who: "anna", post: EXAM });
  await certOpen(page);
  const c = await cert(page);
  ok("CERT: лист сертификата открыт", !!c, await screenName(page));
  ok("CERT: лист в пределах экрана, поля слева и справа равны (раньше торчал на 4 px с каждой стороны)", c.l === 20 && c.r === 370 && c.w === 350 && c.vw === 390, [c.l, c.r, c.w]);
  ok("CERT: бумага — светлый лист и в тёмной теме", /linear-gradient\(168deg, rgb\(252, 248, 238\)/.test(c.bg), c.bg);
  ok("CERT: имя, роль, «сдан на 92%»", c.name === "Анна Смирнова" && !!c.role && c.done === "сдан на 92%" && c.nameFs === 26, [c.name, c.role, c.done, c.nameFs]);
  ok("CERT: дата и срок действия на год", c.date === "12 ноября 2026" && c.until === "действует до 12 ноября 2027", [c.date, c.until]);
  ok("CERT: на листе нет «сдал(а)» и канцелярита", !/сдал\(а\)|Настоящим|Результат:/.test(c.text) && /Service Academy/i.test(c.text) && c.text.includes(REST), c.text);
  ok("CERT: сургучная печать с шапочкой — в правом нижнем углу листа", c.seal && c.seal.w === 62 && c.seal.in && c.seal.cap, c.seal);
  ok("CERT: «Поделиться картинкой» — линза, а не заливка цветом роли; «Поделиться текстом» — стекло", c.pic && c.pic.lens === "main" && c.pic.text === "Поделиться картинкой" && c.pic.bg !== "rgb(127, 160, 138)" && c.txt && c.txt.lens === "soft" && c.txt.text === "Поделиться текстом", [c.pic, c.txt]);
  ok("CERT: кнопки по ширине листа, высотой под палец; «Готово» — тихая", c.pic.l === c.l && c.pic.r === c.r && c.pic.h >= 48 && c.txt.l === c.l && c.txt.r === c.r && c.txt.h >= 44 && c.done2 && c.done2.text === "Готово" && c.done2.h >= 44, [c.pic, c.txt, c.done2]);
  await shot(page, "cert-dark");
  // телефон без системного «Поделиться» файлом: просмотр картинки со «Скачать»
  await page.locator("[data-cert-sharepic]").click(); await page.waitForTimeout(1600);
  const pv = await page.evaluate(async () => { const d = document.querySelector("[data-cert-preview]"); if (!d) return null; const im = d.querySelector("img"), a = d.querySelector("[data-cert-save]");
    await (im.decode ? im.decode().catch(() => {}) : null);
    const blob = await (await fetch(im.src)).blob(); const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    return { body: d.parentElement === document.body, w: im.naturalWidth, h: im.naturalHeight, alt: im.alt, type: blob.type, size: blob.size, png: head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47,
      save: a ? { text: a.textContent.trim(), name: a.getAttribute("download"), blob: /^blob:/.test(a.getAttribute("href")), same: a.getAttribute("href") === im.src, lens: a.hasAttribute("data-lens-btn") } : null,
      share: !!d.querySelector("[data-cert-pvshare]"), hint: d.querySelector("p") ? d.querySelector("p").textContent : "", back: !!d.querySelector("[data-sa-back]") }; });
  ok("CERT: без «Поделиться файлом» — просмотр картинки поверх экрана", pv && pv.body && pv.back, pv);
  ok("CERT: картинка — PNG 1080×1350, не пустая", pv && pv.w === 1080 && pv.h === 1350 && pv.type === "image/png" && pv.png && pv.size > 30000, pv && [pv.w, pv.h, pv.type, pv.size]);
  ok("CERT: «Скачать картинку» отдаёт этот же файл с понятным именем; подсказка про удержание есть", pv && pv.save && pv.save.text === "Скачать картинку" && pv.save.name === "certificate-seasonal.png" && pv.save.blob && pv.save.same && !pv.save.lens && !pv.share && /удерживай/.test(pv.hint), pv && [pv.save, pv.share, pv.hint]);
  ok("CERT: у картинки есть описание для диктора", pv && /^Сертификат: экзамен на роль «.+» сдан на 92%$/.test(pv.alt), pv && pv.alt);
  // что на картинке: бумага, тёмный текст, красная печать справа внизу
  const px = await page.evaluate(async () => { const im = document.querySelector("[data-cert-preview] img"); const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350; const x = cv.getContext("2d"); x.drawImage(im, 0, 0);
    const at = (px, py) => [...x.getImageData(px, py, 1, 1).data].slice(0, 3); const dark = (x0, y0, w, h) => { const d = x.getImageData(x0, y0, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 240) n++; return n; };
    return { paper: at(540, 470), corner: at(20, 20), seal: at(864, 1090), title: dark(220, 250, 640, 110), name: dark(150, 540, 780, 110), role: dark(300, 770, 480, 90), low: dark(110, 1070, 500, 150), frameL: at(47, 675), frameR: at(1033, 675) }; });
  ok("CERT: картинка — бумажный лист с рамкой по обоим краям", px.paper[0] > 235 && px.paper[2] > 205 && px.corner[0] > 235 && px.frameL[0] < 190 && px.frameR[0] < 190, [px.paper, px.corner, px.frameL, px.frameR]);
  ok("CERT: на картинке есть заголовок, имя, роль и строки внизу; печать красная", px.title > 3000 && px.name > 2500 && px.role > 1200 && px.low > 600 && px.seal[0] > 120 && px.seal[0] > px.seal[1] * 1.8, px);
  await shot(page, "cert-preview");
  ok("CERT: «назад» Telegram сначала закрывает просмотр — сертификат остаётся", (await tgBack(page)) === "preview" && (await page.locator("[data-cert-preview]").count()) === 0 && !!(await cert(page)));
  ok("CERT: потом «назад» возвращает к списку сертификатов", (await tgBack(page)) === "text" && !(await cert(page)) && (await page.getByText("Открыть сертификат").count()) >= 1);
  ok("CERT: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();

  // телефон с системным «Поделиться»: картинка уходит файлом, текст — строкой
  const s = await open({ who: "anna", post: EXAM, share: true });
  await certOpen(s.page);
  await s.page.waitForTimeout(900);   // картинка рисуется заранее
  await s.page.locator("[data-cert-sharepic]").click(); await s.page.waitForTimeout(900);
  const sh1 = await s.page.evaluate(() => ({ shared: window.__shared, sent: document.querySelector("[data-cert-sent]") ? document.querySelector("[data-cert-sent]").textContent : "", pv: !!document.querySelector("[data-cert-preview]") }));
  ok("CERT: с системным «Поделиться» картинка уходит файлом PNG, без просмотра", sh1.shared.length === 1 && sh1.shared[0].files.length === 1 && sh1.shared[0].files[0].name === "certificate-seasonal.png" && sh1.shared[0].files[0].type === "image/png" && sh1.shared[0].files[0].size > 30000 && !sh1.pv, sh1);
  ok("CERT: после отправки — «Отправлено»", sh1.sent === "Отправлено", sh1.sent);
  await s.page.locator("[data-cert-sharetext]").click(); await s.page.waitForTimeout(700);
  const sh2 = await s.page.evaluate(() => window.__shared[1] || null);
  ok("CERT: «Поделиться текстом» — строка без «сдал(а)», с подписью и ссылкой", sh2 && !sh2.files.length && /^Экзамен на роль «.+» в Service Academy сдан на 92%\.\nАнна Смирнова · Два моря, Океан\nhttps?:\/\/\S+$/.test(sh2.text), sh2);
  ok("CERT: с «Поделиться» ошибок нет", s.errs.length === 0, s.errs);
  await s.ctx.close();

  // Telegram: текст уходит в выбор чата
  const t = await open({ who: "anna", post: EXAM });
  await certOpen(t.page);
  await t.page.evaluate(() => { window.__tgLinks = []; window.Telegram = { WebApp: { ...(window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : {}), initData: "x", openTelegramLink: (u) => window.__tgLinks.push(u) } }; });
  await t.page.locator("[data-cert-sharetext]").click(); await t.page.waitForTimeout(600);
  const tg = await t.page.evaluate(() => ({ links: window.__tgLinks, sent: document.querySelector("[data-cert-sent]") ? document.querySelector("[data-cert-sent]").textContent : "" }));
  const tgText = tg.links[0] ? decodeURIComponent((/[?&]text=([^&]*)/.exec(tg.links[0]) || [0, ""])[1]) : "";
  ok("CERT: в Telegram «Поделиться текстом» открывает выбор чата с этой строкой", tg.links.length === 1 && /^https:\/\/t\.me\/share\/url\?url=/.test(tg.links[0]) && /^Экзамен на роль «.+» в Service Academy сдан на 92%\.\nАнна Смирнова · Два моря, Океан$/.test(tgText) && tg.sent === "Выбери чат в Telegram", [tg, tgText]);
  await t.ctx.close();

  // узкий телефон и «Для чтения»
  const n = await open({ who: "anna", post: EXAM, width: 320, height: 640 });
  await certOpen(n.page);
  const c3 = await cert(n.page);
  ok("CERT: 320 px — лист в пределах экрана, имя целиком, печать на листе", c3 && c3.l >= 0 && c3.r <= 320 && c3.l === 320 - c3.r && c3.seal.in && c3.name === "Анна Смирнова" && (await overflowX(n.page)) <= 0, c3 && [c3.l, c3.r, c3.seal]);
  await shot(n.page, "cert-320");
  await n.ctx.close();
  const l = await open({ who: "anna", post: EXAM, light: true });
  await certOpen(l.page);
  const c4 = await cert(l.page);
  ok("CERT: «Для чтения» — тот же лист и те же слова; кнопки — светлые линзы", c4 && c4.bg === c.bg && c4.name === c.name && c4.done === c.done && c4.until === c.until && c4.l === 20 && c4.r === 370 && c4.pic.lens === "main" && c4.pic.color !== c.pic.color, c4 && [c4.bg, c4.pic]);
  await shot(l.page, "cert-light");
  await l.page.locator("[data-cert-sharepic]").click(); await l.page.waitForTimeout(1500);
  const lp = await l.page.evaluate(() => { const d = document.querySelector("[data-cert-preview]"), a = d && d.querySelector("[data-cert-save]"); return d ? { bg: getComputedStyle(d).backgroundColor, ink: getComputedStyle(a).color } : null; });
  ok("CERT: просмотр картинки и в «Для чтения» тёмный, кнопка читается", lp && lp.bg === "rgb(13, 9, 5)" && lp.ink === "rgb(240, 217, 160)", lp);
  await shot(l.page, "cert-preview-light");
  ok("CERT: в «Для чтения» ошибок нет", l.errs.length === 0, l.errs);
  await l.ctx.close();
}

// ═══ OWNER: список сотрудников ══════════════════════════════════════════════════════════════════════════
const staff = (page) => page.evaluate(() => [...document.querySelectorAll(".sa-btn[data-lens-card]")].filter((r) => /Активен|Ждёт код|Неактивен|Отключён|Заблокирован/.test(r.innerText)).map((r) => { const rr = r.getBoundingClientRect();
  const f = r.querySelector("[data-emp-face]"), d = f ? f.querySelector("[data-lens='disc']") : null, dr = d ? d.getBoundingClientRect() : null, img = f ? f.querySelector("img[data-face]") : null, dot = f ? f.querySelector("[data-emp-dot]") : null, tr = dot ? dot.getBoundingClientRect() : null;
  const old = !f ? r.firstElementChild : null, or = old ? old.getBoundingClientRect() : null, nm = r.children[1].firstElementChild, nr = nm.getBoundingClientRect();
  return { name: nm.textContent.trim(), h: Math.round(rr.height), l: Math.round(rr.left), r: Math.round(rr.right), nameL: Math.round(nr.left), cut: nm.scrollWidth > nm.clientWidth + 1,
    face: dr ? { w: Math.round(dr.width), h: Math.round(dr.height), round: getComputedStyle(d).borderRadius === "50%", hidden: f.getAttribute("aria-hidden"), cy: Math.round(dr.top + dr.height / 2 - rr.top - rr.height / 2), letters: d.firstElementChild.textContent.trim(), crown: !!d.firstElementChild.querySelector("svg") } : null,
    img: img ? { ok: img.complete && img.naturalWidth > 0, zoom: img.getAttribute("data-face-zoom"), pe: getComputedStyle(img).pointerEvents } : null,
    dot: tr ? { w: Math.round(tr.width), h: Math.round(tr.height), dx: Math.round(tr.right - dr.right), dy: Math.round(tr.bottom - dr.bottom), color: getComputedStyle(dot).backgroundColor } : null,
    old: or ? { w: Math.round(or.width), h: Math.round(or.height) } : null }; }));
if (want("OWNER")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await nav(page, "team", 2600);
  const rows = await staff(page);
  ok("OWNER: список сотрудников открыт, в каждой строке — кружок с лицом", rows.length >= 8 && rows.every((r) => r.face && r.face.w === 38 && r.face.h === 38 && r.face.round && r.face.hidden === "true"), rows.map((r) => [r.name, r.face && r.face.w]));
  const withImg = rows.filter((r) => r.img), anna = rows.find((r) => r.name === "Анна Смирнова"), maria = rows.find((r) => r.name === "Мария Ким");
  ok("OWNER: у Марии и ещё пятерых — фото; у Анны — буквы «АС»", withImg.length === 6 && maria && maria.img && maria.img.ok && anna && !anna.img && anna.face.letters === "АС", rows.map((r) => [r.name, !!r.img, r.face.letters]));
  ok("OWNER: фото в строке касаний не ловит — строка открывает карточку", withImg.every((r) => r.img.pe === "none" && r.img.zoom === null));
  ok("OWNER: статус — точкой 11 px в правом нижнем углу кружка, цветной", rows.every((r) => r.dot && r.dot.w === 11 && r.dot.h === 11 && Math.abs(r.dot.dx) <= 2 && Math.abs(r.dot.dy) <= 2 && /^rgb/.test(r.dot.color) && r.dot.color !== "rgba(0, 0, 0, 0)"), rows.map((r) => r.dot));
  ok("OWNER: кружок по центру строки, имя — правее в 12 px, строки одной высоты и в пределах экрана", rows.every((r) => Math.abs(r.face.cy) <= 1 && r.nameL === r.l + 14 + 1 + 38 + 12 && r.h === rows[0].h && r.l >= 0 && r.r <= 390) && rows.every((r) => !r.cut), rows.map((r) => [r.face.cy, r.nameL - r.l, r.h, r.cut]));
  const me = rows.find((r) => r.face.crown);
  ok("OWNER: у владельца без фото в кружке корона, как в его карточке", !!me && !me.img, rows.map((r) => [r.name, r.face.crown]));
  await shot(page, "owner-dark");
  await page.locator(".sa-btn[data-lens-card]", { hasText: "Мария Ким" }).first().locator("[data-emp-face]").click(); await page.waitForTimeout(1100);
  const cardOpen = await page.evaluate(() => ({ viewer: !!document.querySelector("[data-face-view]"), text: document.body.innerText.slice(0, 600) }));
  ok("OWNER: нажатие на лицо в строке открывает карточку сотрудника, а не фото крупно", !cardOpen.viewer && /Мария Ким/.test(cardOpen.text) && /Сбросить|Отключить|Код|Должность/.test(cardOpen.text), cardOpen.text.slice(0, 200));
  ok("OWNER: список не вылезает вбок", (await overflowX(page)) <= 0);
  ok("OWNER: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ SMALL: вход, карта обучения, «Первые шаги» ═════════════════════════════════════════════════════════
if (want("SMALL")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await nav(page, "login", 1800);
  const lg = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Войти"), i = document.querySelector("input"); if (!b || !i) return null; const cs = getComputedStyle(b);
    return { lens: b.getAttribute("data-lens-btn"), img: cs.backgroundImage, color: cs.color, ph: i.getAttribute("placeholder"), phColor: getComputedStyle(i, "::placeholder").color, text: document.body.innerText }; });
  ok("SMALL: вход — «Войти» линза с золотыми буквами, а не заливка золотом", lg && lg.lens === "main" && /^radial-gradient\(120% 160% at 50% 0%, rgba\(232, 201, 131, 0\.24\)/.test(lg.img) && lg.color === "rgb(232, 201, 131)", lg && [lg.lens, lg.img.slice(0, 80), lg.color]);
  ok("SMALL: в поле кода — «Введи код», как текст над ним", lg && lg.ph === "Введи код" && lg.phColor === "rgba(200, 180, 152, 0.65)" && /Введи код доступа/.test(lg.text) && !/Введите/.test(lg.text), lg && [lg.ph, lg.phColor]);
  await shot(page, "login-dark");
  await page.locator("input").first().fill("ABCD"); await page.waitForTimeout(300);
  ok("SMALL: поле кода принимает ввод", (await page.locator("input").first().inputValue()).replace(/[^A-Z]/g, "") === "ABCD");
  await nav(page, "home", 900); await nav(page, "trainingCard", 2200);
  const tc = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Распечатать/.test(x.textContent)); if (!b) return null; const cs = getComputedStyle(b); return { lens: b.getAttribute("data-lens-btn"), text: b.textContent.trim(), color: cs.color, bg: cs.backgroundColor, img: cs.backgroundImage.slice(0, 50) }; });
  ok("SMALL: карта обучения — «Распечатать · сохранить в PDF» линза", tc && tc.lens === "main" && /Распечатать/.test(tc.text) && tc.color !== "rgb(26, 16, 8)", tc);
  await nav(page, "mastery", 2400);
  const fs = await page.evaluate(() => { const c = document.querySelector("[data-ms-first]"); if (!c) return null; const head = c.innerText.split("\n").slice(0, 3).join(" ");
    const bar = [...c.querySelectorAll("div")].find((d) => d.children.length >= 3 && [...d.children].every((s) => s.tagName === "SPAN" && s.getBoundingClientRect().height === 5));
    const segs = bar ? [...bar.children].map((s) => getComputedStyle(s).backgroundColor) : []; const m = /(\d+) из (\d+)/.exec(head);
    return { head, done: m ? +m[1] : null, of: m ? +m[2] : null, segs }; });
  const lit = fs && fs.segs.length ? fs.segs.map((x) => x !== fs.segs[fs.segs.length - 1] || x === fs.segs[0]) : [];
  ok("SMALL: «Первые шаги» — сегментов столько же, сколько шагов", fs && fs.of && fs.segs.length === fs.of, fs);
  ok("SMALL: полоска заполнена слева: горят первые «сделано» сегментов, остальные погашены", fs && fs.done >= 1 && fs.done < fs.of && fs.segs.slice(0, fs.done).every((x) => x === fs.segs[0]) && fs.segs.slice(fs.done).every((x) => x === fs.segs[fs.of - 1]) && fs.segs[0] !== fs.segs[fs.of - 1], fs && [fs.done, fs.of, fs.segs, lit]);
  await page.evaluate(() => document.querySelector("[data-ms-first]").scrollIntoView({ block: "center" })); await page.waitForTimeout(400);
  await shot(page, "steps-dark");
  ok("SMALL: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ NO52: сервер без фото сотрудников ══════════════════════════════════════════════════════════════════
if (want("NO52")) {
  const { ctx, page, errs } = await open({ who: "anna", no52: true, pulse: true, post: EXAM });
  await toTeam(page);
  const list = await cards(page);
  ok("NO52: карточки о людях — с прежними корешками, лиц нет", list.length >= 6 && list.every((c) => !c.emp && !c.face && !c.img && /^ch-tl ch-tl-[id]$/.test(c.cls)), list.map((c) => [c.kind, c.cls]));
  const same = cardHeights ? list.filter((c) => c.id in cardHeights) : [];
  ok("NO52: высота карточек с лицом и без — одна и та же", same.length >= 6 && same.every((c) => c.h === cardHeights[c.id]), same.map((c) => [c.kind, c.h, cardHeights && cardHeights[c.id]]));
  ok("NO52: чат закрывается кнопкой «назад»", await closeChat(page));
  await nav(page, "home", 900); await nav(page, "teamHub", 2600); await page.waitForTimeout(900);
  const f = await feedRows(page);
  ok("NO52: «Жизнь команды» как была — кружок 24 px (с ободком 26) со значком события, без лиц и букв", f && f.rows.length === 3 && f.rows.every((r) => !r.face && r.w === 26 && r.h === 26 && !r.img && !r.badge && r.letters === "" && r.gap === 10), f && f.rows.map((r) => [r.w, r.face, r.letters]));
  await mock(page, "league_week", league([["e-vera", "Вера", "Соколова", "waiter", 140], ["u-maria", "Мария", "Ким", "manager", 125], ["e-anna", "Анна", "Смирнова", "waiter", 96], ...TAIL]));
  await nav(page, "league", 2800);
  const p = await podium(page);
  ok("NO52: подиум лиги без кружков, в строках — прежние номера мест", p && p.cols.length === 3 && p.cols.every((c) => !c.face) && (await page.locator("[data-rank-face]").count()) === 0, p && p.cols.map((c) => [c.name, !!c.face]));
  await certOpen(page);
  const c = await cert(page);
  ok("NO52: сертификат — тот же лист", c && c.name === "Анна Смирнова" && c.done === "сдан на 92%" && c.l === 20 && c.r === 370, c && [c.name, c.done, c.l, c.r]);
  ok("NO52: у сотрудника ошибок нет", errs.length === 0, errs);
  await ctx.close();
  const o = await open({ who: "roman", no52: true });
  await nav(o.page, "team", 2600);
  const rows = await staff(o.page);
  ok("NO52: список сотрудников как был — точка статуса 9 px, кружков нет", rows.length >= 8 && rows.every((r) => !r.face && r.old && r.old.w === 9 && r.old.h === 9 && r.nameL === r.l + 14 + 1 + 9 + 12), rows.map((r) => [r.name, r.old, r.nameL - r.l]));
  ok("NO52: у владельца ошибок нет", o.errs.length === 0, o.errs);
  await o.ctx.close();
}

// ═══ LOOK: «Для чтения» и узкий телефон ═════════════════════════════════════════════════════════════════
if (want("LOOK")) {
  for (const [tag, opt] of [["light", { light: true }], ["320", { width: 320, height: 640 }]]) {
    const { ctx, page, errs } = await open({ who: "anna", pulse: true, ...opt });
    const vw = opt.width || 390;
    await toTeam(page);
    const list = await cards(page), withFace = list.filter((c) => c.emp);
    ok("LOOK " + tag + ": корешки с лицами на месте — круг 48 px по центру, подпись и значок в корешке", withFace.length >= 5 && withFace.every((c) => c.face.w === 48 && Math.abs(c.face.cx - (c.stub.l + c.stub.r) / 2) <= 1 && c.cap.l >= c.stub.l && c.cap.r <= c.stub.r && (!c.badge || c.badge.r <= c.stub.r)), withFace.map((c) => [c.face, c.cap, c.stub, c.badge]));
    const anniv = list.find((c) => c.kind === "anniv");
    await page.evaluate((id) => document.querySelector('.ch-row[data-chat-msg="' + id + '"]').scrollIntoView({ block: "center" }), anniv.id); await page.waitForTimeout(400);
    await shot(page, "cards-" + tag);
    ok("LOOK " + tag + ": чат не вылезает вбок", (await overflowX(page)) <= 0);
    await closeChat(page);
    await nav(page, "home", 900); await nav(page, "teamHub", 2600);
    await page.evaluate(() => { const f = document.querySelector("[data-team-feed]"); if (f) f.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(1200);
    const f = await feedRows(page);
    ok("LOOK " + tag + ": «Жизнь команды» — кружки с лицами, текст и время не наезжают, карточка в экране", f && f.rows.every((r) => r.face && r.w === 34 && r.gap === 10 && r.textR <= r.whenL && r.whenR <= r.rowR + 1) && f.l >= 0 && f.r <= vw, f && [f.l, f.r, f.rows.map((r) => [r.w, r.gap, r.textR, r.whenL])]);
    await shot(page, "feed-" + tag);
    await mock(page, "league_week", league([["e-vera", "Вера", "Соколова", "waiter", 140], ["u-maria", "Мария", "Ким", "manager", 125], ["e-anna", "Анна", "Смирнова", "waiter", 96], ["e-petr", "Пётр", "Орлов", "waiter", 80], ...TAIL]));
    await nav(page, "league", 2800);
    await page.evaluate(() => { const p = document.querySelector("[role=group][aria-label='Подиум недели']"); if (p) p.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(500);
    const p = await podium(page);
    ok("LOOK " + tag + ": подиум — три лица над своими пьедесталами, в пределах экрана", p && p.cols.length === 3 && p.cols.every((c) => c.face && Math.abs(c.face.cx - c.pedCx) <= 1 && c.textTop >= c.face.bottom + 4) && p.l >= 0 && p.r <= vw, p && [p.l, p.r, p.cols.map((c) => [c.face && c.face.cx, c.pedCx])]);
    await shot(page, "podium-" + tag);
    ok("LOOK " + tag + ": лига не вылезает вбок", (await overflowX(page)) <= 0);
    ok("LOOK " + tag + ": у сотрудника ошибок нет", errs.length === 0, errs);
    await ctx.close();
    const o = await open({ who: "roman", ...opt });
    await nav(o.page, "team", 2600);
    const rows = await staff(o.page);
    ok("LOOK " + tag + ": список сотрудников — кружки 38 px с точкой статуса, строки в экране", rows.length >= 8 && rows.every((r) => r.face && r.face.w === 38 && r.dot && r.dot.w === 11 && r.l >= 0 && r.r <= vw) && (await overflowX(o.page)) <= 0, rows.map((r) => [r.name, r.face && r.face.w, r.l, r.r]));
    await shot(o.page, "owner-" + tag);
    ok("LOOK " + tag + ": у владельца ошибок нет", o.errs.length === 0, o.errs);
    await o.ctx.close();
  }
  const { ctx, page } = await open({ who: "anna", light: true });
  await nav(page, "login", 1800);
  const lg = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Войти"); const cs = getComputedStyle(b), sc = b.closest("[data-lens-dark]"), inp = document.querySelector("input");
    return { color: cs.color, img: cs.backgroundImage.slice(0, 80), ring: getComputedStyle(b, "::after").borderTopColor, lens: b.getAttribute("data-lens-btn"), light: document.documentElement.classList.contains("sa-light"), dark: !!sc, bg: sc ? getComputedStyle(sc).backgroundImage.slice(0, 50) : "",
      ph: getComputedStyle(inp, "::placeholder").color, caret: getComputedStyle(inp).caretColor }; });
  ok("LOOK light: подсказка «Введи код» на тёмном поле светлая, как в тёмной теме", lg.ph === "rgba(200, 180, 152, 0.65)" && lg.caret === "rgb(200, 169, 110)", [lg.ph, lg.caret]);
  ok("LOOK light: экран входа и в «Для чтения» тёмный — «Войти» на нём тёмная линза с золотыми буквами, а не блёклая светлая", lg.light && lg.dark && lg.lens === "main" && lg.color === "rgb(232, 201, 131)" && /^radial-gradient\(120% 160% at 50% 0%, rgba\(232, 201, 131, 0\.24\)/.test(lg.img) && lg.ring === "rgba(214, 178, 102, 0.44)", lg);
  await shot(page, "login-light");
  await ctx.close();
}

await browser.close(); server.close();
console.log("\nитого: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
