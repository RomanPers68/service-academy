// e2e v173 (Доп. 498): серая плашка в поиске. Владелец: «Заметил артефакт в поиске, когда пишешь а после скролишь». В браузере,
// на демо целиком (tools/claude/demo-app/build.mjs). Саму плашку здесь не увидеть: её рисует iPhone (подсветка автозамены),
// в настольном браузере её нет. Сценарий проверяет то, от чего она зависит, и то, что правка ничего не сломала:
//   FIELD  — телефон 402 px, сотрудник: «Поиск» открыт значком в шапке, поле в работе; автозамена и подчёркивание выключены,
//            клавиша ввода «Найти»; набрано «Эсп»: те же карточки, что на записи; список тянут пальцем при открытом поле:
//            поле остаётся в работе, запрос и результаты на месте; «Найти» убирает клавиатуру; запрос и недавние живы;
//   DESK   — компьютер 1280 px: свойства те же, клавиша ввода поле не закрывает;
//   REF    — «Справочник»: его поиск (тот же экран) с теми же свойствами;
//   ALL    — другие строки поиска: «Барная карта» (коктейли и вина), «Глоссарий», колода меню, колода бармена, «Команда»,
//            редактор вин; у каждой свойства на месте, «Найти» убирает клавиатуру, набранное остаётся;
//   LOOK   — 320 px и светлая тема: поле не вылезает, шрифт не мельче 10.5 px; обычное поле (сообщение в чате) не тронуто.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_ONLY="FIELD"] node e2e-v173.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5673, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v173";
const ONLY = (process.env.E2E_ONLY || "").split(/\s+/).filter(Boolean);
const on = (name) => !ONLY.length || ONLY.includes(name);
mkdirSync(OUT, { recursive: true });
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
const same = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const browser = await chromium.launch();

async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.evaluate(() => { if (window.__e2eTidy) return; window.__e2eTidy = setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    document.querySelectorAll("[data-badge-new] [data-lens-x], [data-shelf-new] button[aria-label='Закрыть']").forEach((x) => x.click());
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" }).catch(() => {});
  await page.waitForTimeout(1100);
}
async function open({ who = "roman", light = false, width = 440, height = 956, flags = {} } = {}) {
  const mobile = width < 900;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 200)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, f]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", w); for (const [k, v] of Object.entries(f)) localStorage.setItem(k, v); }, [who, flags]);
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1100); }
  return { ctx, page, errs };
}
// другой человек в той же вкладке: сервер демо (и правки справочника в нём) остаётся
async function switchTo(page, errs, who) {
  await page.evaluate((w) => { window.__demo.save(); localStorage.setItem("__demo_who", w); localStorage.removeItem("__demo_me"); }, who);
  await page.goto(URL0 + "#" + who, { waitUntil: "load" });
  await page.reload({ waitUntil: "load" });
  await ready(page, errs);
}
const shot = async (page, n) => { await page.waitForTimeout(300); await page.screenshot({ path: OUT + "/" + n + ".png" }).catch(() => {}); };
const tap = async (page, sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(320); };
const nav = async (page, screen, sel) => { await page.evaluate((s) => window.__saNav(s), screen); if (sel) await page.waitForSelector(sel, { timeout: 15000 }); await page.waitForTimeout(350); };
const attrs = (page, a) => page.evaluate((x) => [...document.querySelectorAll("[" + x + "]")].map((el) => el.getAttribute(x)), a);
const has = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const txt = (page, sel = "#root") => page.evaluate((s) => { const el = document.querySelector(s); return el ? el.innerText.replace(/\s+/g, " ") : ""; }, sel);
const rows = (page) => page.evaluate(() => Object.values(window.__demo.srv.S.rb.items).map((x) => [x.id, x.kind, x.parent, x.title, x.hidden, x.sort]));
const photosOnServer = (page) => page.evaluate(() => Object.entries(window.__demo.srv.S.lp).filter(([, v]) => v).map(([k]) => k));
const blur = (page) => page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
// выделить строки текста главы с номера a по номер b (с нуля)
const selLines = (page, a, b) => page.evaluate(([x, y]) => { const t = document.querySelector("[data-re-ch-body]"); const ls = t.value.split("\n"); let s = 0; for (let i = 0; i < x; i++) s += ls[i].length + 1;
  let e = s; for (let i = x; i <= y; i++) e += ls[i].length + (i < y ? 1 : 0); t.focus(); t.setSelectionRange(s, e); }, [a, b]);
const seedBook = (page, items) => page.evaluate((it) => { const r = window.__demo.srv.rpc("ref_book_save", { p_token: "demo-u-roman", p_items: it, p_del: [] }); window.__demo.save(); return r; }, items);
const R = (id, kind, more = {}) => ({ id, kind, parent: "", title: null, sub: null, body: null, hidden: false, sort: null, ...more });
// ничего не вылезает за край и шрифт не мельче 10.5 px
const look = (page) => page.evaluate(() => {
  const root = document.querySelector("[data-re-screen]") || document.getElementById("root");
  const vw = document.documentElement.clientWidth;
  let small = null, wide = null;
  for (const el of root.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right > vw + 1 && !wide) wide = el.tagName + " " + Math.round(r.right) + " > " + vw + " " + (el.textContent || "").slice(0, 40);
    if (el.closest("svg")) continue;   // буквы внутри значка (знак «AI») — рисунок, а не текст
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) { const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 10.5 && !small) small = fs + "px «" + el.textContent.trim().slice(0, 40) + "»"; }
  }
  return { small, wide, scroll: document.documentElement.scrollWidth <= vw + 1 };
});
// картинка для загрузки: рисуем в странице, отдаём файлом
async function photoFile(page, name) {
  const b64 = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 1200; c.height = 800; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 1200, 800);
    g.addColorStop(0, "#3a2a14"); g.addColorStop(1, "#c8a96e"); x.fillStyle = g; x.fillRect(0, 0, 1200, 800); x.fillStyle = "#fff"; x.font = "80px serif"; x.fillText("Зал утром", 380, 420); return c.toDataURL("image/jpeg", 0.9).split(",")[1]; });
  const p = join(tmpdir(), name);
  writeFileSync(p, Buffer.from(b64, "base64"));
  return p;
}
const BASE_CARDS = ["serving", "wine", "coffee", "bar"];   // v172 (Доп. 497): четвёртым — «Бар: Основы» (была карточка «Барная карта»)
// «Команда»: группа «Управление» свёрнута кнопкой — раскрыть и вернуть подписи её строк
async function management(page) {
  await nav(page, "teamHub", "[data-hub-group]");
  if (await has(page, "[data-hub-group='Управление'][data-hub-open='0']")) await tap(page, "[data-hub-toggle='Управление']");
  await page.waitForTimeout(350);
  return txt(page, "[data-hub-group='Управление']");
}

const Q = 'input[placeholder^="Блюдо, аллерген"]';
// поле глазами клавиатуры телефона: автозамена, подчёркивание, подпись клавиши ввода; в работе ли оно и где стоит
const fieldOf = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  return { ac: el.getAttribute("autocorrect"), sp: el.getAttribute("spellcheck"), ek: el.getAttribute("enterkeyhint"), cap: el.getAttribute("autocapitalize"), focused: document.activeElement === el, value: el.value,
    fs: parseFloat(cs.fontSize), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) }; }, sel);
const quiet = (f) => !!f && f.ac === "off" && f.sp === "false" && f.ek === "search";
const coarse = (page) => page.evaluate(() => matchMedia("(pointer: coarse)").matches);
const scrollTop = (page) => page.evaluate(() => Math.round(document.getElementById("root").scrollTop));
// карточки результатов: первые строки текста; нажатые (сжатые) карточки
const cards = (page) => page.evaluate(() => [...document.querySelectorAll("#root .sa-card")].map((c) => c.innerText.replace(/\s+/g, " ").trim().slice(0, 40)));
const pressed = (page) => page.evaluate(() => [...document.querySelectorAll("#root .sa-card")].filter((c) => { const t = getComputedStyle(c).transform; return c.matches(":active") || (t && t !== "none" && t !== "matrix(1, 0, 0, 1, 0, 0)"); }).length);
const centerOf = (page, re) => page.evaluate((src) => { const c = [...document.querySelectorAll("#root .sa-card")].find((x) => new RegExp(src).test(x.textContent)); if (!c) return null; const r = c.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }, re);
// палец по списку: лёг на точку, полежал, тянет на dy (минус: вверх) и отпускает. Настоящие касания, как у телефона
async function drag(ctx, page, at, dy, hold = 80) {
  const cdp = await ctx.newCDPSession(page);
  const t = (type, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: at.x, y: Math.round(y), id: 1 }] });
  await t("touchStart", at.y); await page.waitForTimeout(hold);
  const n = Math.max(6, Math.round(Math.abs(dy) / 15));
  for (let k = 1; k <= n; k++) { await t("touchMove", at.y + (dy * k) / n); await page.waitForTimeout(25); }
  await page.waitForTimeout(120);
  const mid = { top: await scrollTop(page), pressed: await pressed(page) };
  await t("touchEnd"); await page.waitForTimeout(400);
  await cdp.detach();
  return mid;
}
const jsClick = async (page, sel) => { const done = await page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); return !!el; }, sel); await page.waitForTimeout(450); return done; };
const typeIn = async (page, sel, text) => { await page.locator(sel).first().focus(); await page.keyboard.type(text, { delay: 40 }); await page.waitForTimeout(450); };
const enter = async (page) => { await page.keyboard.press("Enter"); await page.waitForTimeout(250); };
// подсказки первого входа перехватывают касания: отмечаем виденными (ключи одной версии подсказок)
const skipHints = (page, names) => page.evaluate((ns) => { const k = Object.keys(localStorage).find((x) => /^sa_hint_v\d+_/.test(x)); const pre = k ? k.replace(/^(sa_hint_v\d+_).*/, "$1") : null; if (pre) for (const n of ns) localStorage.setItem(pre + n, "1"); return pre; }, names);

// ── FIELD ──────────────────────────────────────────────────────────────────────────────────────────────
if (on("FIELD")) {
  const { ctx, page, errs } = await open({ who: "anna", width: 402, height: 874 });
  ok("FIELD: у телефона клавиатура на экране (палец как основной указатель)", await coarse(page));
  ok("FIELD: значок поиска есть в шапке", await jsClick(page, "[data-top-search]"));
  await page.waitForSelector(Q, { timeout: 15000 });
  await page.waitForTimeout(500);
  const f0 = await fieldOf(page, Q);
  ok("FIELD: «Поиск» открыт, поле сразу в работе", !!f0 && f0.focused && f0.value === "", f0);
  ok("FIELD: автозамена и подчёркивание выключены, клавиша ввода подписана «Найти»", quiet(f0), f0);
  ok("FIELD: заглавная буква в начале остаётся как была; шрифт поля 16 px", !!f0 && f0.cap === null && f0.fs === 16, f0);
  ok("FIELD: пока пусто, подсказка «Введи минимум 2 буквы»", /Введи минимум 2 буквы\. Ищу в меню/.test(await txt(page)));
  // набор, как на записи владельца
  await page.keyboard.type("Эсп", { delay: 70 }); await page.waitForTimeout(500);
  const t1 = await txt(page), c1 = await cards(page);
  ok("FIELD: набрано «Эсп»: разделы «Барная карта», «Глоссарий», «Справочник» по порядку", t1.indexOf("Барная карта") > 0 && t1.indexOf("Барная карта") < t1.indexOf("Глоссарий") && t1.indexOf("Глоссарий") < t1.indexOf("Справочник"), t1.slice(0, 300));
  ok("FIELD: те же карточки, что на записи: «Эспрессо мартини», «Ристретто», «Эспрессо: эталон и настройка», «Зерно…»",
    ["Эспрессо мартини", "Ристретто", "Эспрессо: эталон и настройка", "Зерно: с чего начинается вкус"].every((w) => t1.includes(w)), c1);
  const f1 = await fieldOf(page, Q);
  ok("FIELD: после набора поле в работе, в нём «Эсп»", f1.focused && f1.value === "Эсп", f1);
  await shot(page, "search-typed");
  // список тянут пальцем при открытом поле: палец лежит на карточке «Зерно…», как на записи
  const at = await centerOf(page, "Зерно: с чего начинается вкус");
  ok("FIELD: карточка «Зерно…» на экране", !!at && at.y > 0 && at.y < 874, at);
  const mid = await drag(ctx, page, at, -180, 400);
  const top2 = await scrollTop(page), f2 = await fieldOf(page, Q);
  ok("FIELD: список потянули пальцем вверх: он уехал", top2 > 100 && mid.top > 100, { mid, top2 });
  ok("FIELD: поле уехало вместе со списком, на том же расстоянии", Math.abs(f1.top - top2 - f2.top) <= 2, { before: f1.top, top2, after: f2.top });
  ok("FIELD: поле осталось в работе, запрос на месте", f2.focused && f2.value === "Эсп", f2);
  same("FIELD: карточки после прокрутки те же", await cards(page), c1);
  ok("FIELD: палец отпустили: ни одна карточка не осталась нажатой", (await pressed(page)) === 0);
  await shot(page, "search-scrolled");
  // печатать можно и после прокрутки: поле никуда не делось
  await page.keyboard.type("р", { delay: 70 }); await page.waitForTimeout(450);
  const f3 = await fieldOf(page, Q);
  ok("FIELD: после прокрутки печатается дальше: «Эспр»", f3.value === "Эспр" && f3.focused && (await txt(page)).includes("Эспрессо мартини"), f3);
  await page.keyboard.press("Backspace"); await page.waitForTimeout(450);
  // обратно вниз пальцем
  const at2 = await centerOf(page, "Эспрессо: эталон и настройка");
  await drag(ctx, page, at2, 260);
  ok("FIELD: потянули вниз: список вернулся к началу", (await scrollTop(page)) <= 2, await scrollTop(page));
  // «Найти» убирает клавиатуру
  const f4 = await fieldOf(page, Q);
  ok("FIELD: перед «Найти» поле в работе, запрос «Эсп»", f4.focused && f4.value === "Эсп", f4);
  await enter(page);
  const f5 = await fieldOf(page, Q);
  ok("FIELD: «Найти» убирает клавиатуру: поле больше не в работе", !f5.focused, f5);
  ok("FIELD: запрос после «Найти» на месте", f5.value === "Эсп", f5);
  same("FIELD: и карточки те же", await cards(page), c1);
  // касание поля возвращает его в работу
  await page.locator(Q).tap(); await page.waitForTimeout(300);
  ok("FIELD: касание возвращает поле в работу", (await fieldOf(page, Q)).focused);
  // карточка открывается, как раньше
  const before = await page.evaluate(() => { const c = [...document.querySelectorAll("#root .sa-card")].find((x) => /^Ристретто/.test(x.innerText.trim())); return c ? c.innerText.length : -1; });
  await page.evaluate(() => { const c = [...document.querySelectorAll("#root .sa-card")].find((x) => /^Ристретто/.test(x.innerText.trim())); if (c) c.click(); }); await page.waitForTimeout(400);
  const after = await page.evaluate(() => { const c = [...document.querySelectorAll("#root .sa-card")].find((x) => /^Ристретто/.test(x.innerText.trim())); return c ? c.innerText.length : -1; });
  ok("FIELD: карточка «Ристретто» раскрывает определение, как раньше", before > 0 && after > before + 20, { before, after });
  // недавние запросы: через 1,2 с запрос запомнен; очистили поле — он чипом; касание чипа возвращает его
  await page.waitForTimeout(1400);
  const rec = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("sa_recent_q") || "[]"); } catch (e) { return null; } });
  ok("FIELD: запрос «Эсп» запомнен в недавних (с заглавной буквы, как набран)", Array.isArray(rec) && rec[0] === "Эсп", rec);
  await page.locator(Q).focus(); for (let k = 0; k < 3; k++) await page.keyboard.press("Backspace"); await page.waitForTimeout(400);
  const chip = await page.evaluate(() => { const s = [...document.querySelectorAll("#root span")].find((x) => x.textContent === "Эсп" && getComputedStyle(x).cursor === "pointer"); if (s) s.click(); return !!s; });
  await page.waitForTimeout(450);
  const f6 = await fieldOf(page, Q);
  ok("FIELD: поле очищено: недавний запрос чипом, касание возвращает «Эсп»", chip && f6.value === "Эсп" && (await txt(page)).includes("Эспрессо мартини"), { chip, f6 });
  same("FIELD: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── DESK ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("DESK")) {
  const { ctx, page, errs } = await open({ who: "roman", width: 1280, height: 900 });
  ok("DESK: у компьютера клавиатуры на экране нет (указатель мышь)", !(await coarse(page)));
  await nav(page, "search", Q);
  const f0 = await fieldOf(page, Q);
  ok("DESK: свойства поля те же: без автозамены и подчёркивания", quiet(f0), f0);
  await typeIn(page, Q, "негрони");
  ok("DESK: «негрони» находится в барной карте", /Барная карта/.test(await txt(page)) && /Негрони/.test(await txt(page)));
  await enter(page);
  const f1 = await fieldOf(page, Q);
  ok("DESK: клавиша ввода поле не закрывает: печатаем дальше без мыши", f1.focused && f1.value === "негрони", f1);
  await page.keyboard.press("Backspace"); await page.waitForTimeout(300);
  ok("DESK: правка запроса сразу после ввода", (await fieldOf(page, Q)).value === "негрон");
  await shot(page, "search-desk");
  same("DESK: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── REF ────────────────────────────────────────────────────────────────────────────────────────────────
if (on("REF")) {
  const { ctx, page, errs } = await open({ who: "anna", width: 402, height: 874 });
  await nav(page, "reference", "[data-ref-card]");
  ok("REF: в «Справочнике» есть строка поиска", await jsClick(page, '[role="search"][aria-label="Поиск по справочнику"]'));
  await page.waitForSelector(Q, { timeout: 15000 }); await page.waitForTimeout(400);
  const f0 = await fieldOf(page, Q);
  ok("REF: поиск справочника: поле в работе, без автозамены и подчёркивания, клавиша «Найти»", quiet(f0) && f0.focused, f0);
  ok("REF: подсказка справочника на месте", /Ищу по главам справочника, глоссарию/.test(await txt(page)));
  await page.keyboard.type("Эсп", { delay: 60 }); await page.waitForTimeout(500);
  ok("REF: «Эсп» находит главу «Эспрессо: эталон и настройка»", (await txt(page)).includes("Эспрессо: эталон и настройка"));
  await enter(page);
  const f1 = await fieldOf(page, Q);
  ok("REF: «Найти» убирает клавиатуру, запрос на месте", !f1.focused && f1.value === "Эсп", f1);
  same("REF: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── ALL ────────────────────────────────────────────────────────────────────────────────────────────────
if (on("ALL")) {
  const { ctx, page, errs } = await open({ who: "roman", width: 402, height: 874 });
  await skipHints(page, ["barCard"]);
  // [экран, что нажать, чтобы строка появилась (одно или по очереди), строка, что набрать, как названа]
  const LIST = [
    ["wines", null, "[data-bar-search]", "негр", "«Барная карта», коктейли"],
    ["wines", '[data-bar-tab="wine"]', "[data-bar-search]", "шаб", "«Барная карта», вина"],
    ["glossary", null, 'input[placeholder="Поиск термина..."]', "рист", "«Глоссарий»"],
    ["menuTrainer", ['[data-menu-mode="cards"]', '[aria-label="Поиск и разделы"]'], 'input[placeholder^="Блюдо, ингредиент"]', "сыр", "колода меню"],
    ["cocktails", '[aria-label="Поиск и фильтр"]', 'input[placeholder^="Название, ингредиент"]', "джин", "колода бармена"],
    ["team", null, 'input[placeholder^="Поиск по имени"]', "анна", "«Команда»"],
    ["wineEditor", null, 'input[type="search"]', "пино", "редактор вин"],
  ];
  for (const [screen, opener, sel, text, name] of LIST) {
    await page.evaluate((s) => window.__saNav(s), screen); await page.waitForTimeout(1300);
    for (const o of [].concat(opener || [])) { await page.waitForSelector(o, { timeout: 8000 }).catch(() => {}); await jsClick(page, o); }
    const there = await page.waitForSelector(sel, { timeout: 12000 }).then(() => true).catch(() => false);
    ok("ALL: " + name + ": строка поиска на экране", there);
    if (!there) continue;
    const f0 = await fieldOf(page, sel);
    ok("ALL: " + name + ": без автозамены и подчёркивания, клавиша «Найти»", quiet(f0), f0);
    await typeIn(page, sel, text);
    const f1 = await fieldOf(page, sel);
    ok("ALL: " + name + ": набранное в поле, поле в работе", f1.value === text && f1.focused, f1);
    await enter(page);
    const f2 = await fieldOf(page, sel);
    ok("ALL: " + name + ": «Найти» убирает клавиатуру, набранное остаётся", !!f2 && !f2.focused && f2.value === text, f2);
  }
  await shot(page, "all-last");
  same("ALL: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── LOOK ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("LOOK")) {
  for (const [light, name] of [[false, "тёмная"], [true, "светлая"]]) {
    const { ctx, page, errs } = await open({ who: "anna", width: 320, height: 700, light });
    await nav(page, "search", Q);
    await typeIn(page, Q, "Эсп");
    const f = await fieldOf(page, Q), lk = await look(page);
    ok("LOOK: 320 px, " + name + " тема: поле целиком на экране", !!f && f.left >= 0 && f.right <= 320, f);
    ok("LOOK: 320 px, " + name + " тема: ничего не вылезает, шрифт не мельче 10.5 px", !lk.small && !lk.wide && lk.scroll, lk);
    ok("LOOK: 320 px, " + name + " тема: свойства поля те же", quiet(f), f);
    await shot(page, "search-320-" + (light ? "light" : "dark"));
    same("LOOK: " + name + " тема: ошибок на странице нет", errs, []);
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log("\nитог: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
