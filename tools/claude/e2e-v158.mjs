// e2e v158 (Доп. 483): «Давай все пять» — пять улучшений одной версией. Сайт — демо целиком (tools/claude/demo-app/build.mjs:
// сервер в странице с этапом 52, у шести человек «Океана» нарисованные портреты; экран открывает window.__saNav, урок —
// window.__saLesson; человек демо меняется в том же окне, сервер остаётся: __demo_who + перезагрузка).
// Разделы: DONE (после «Урок пройден» под кнопкой — бокал цели дня «1 из 2» и «До конца раздела N шагов»; бокал доливается;
// кнопка «Далее» на месте и нажимается; второй урок — «Цель дня есть»; «Для чтения»), REF (список глав: плитка 52 px — фото,
// рисунок или номер; с картинкой номер в подписи «Глава 2»; «Для чтения»), CHAP (руководитель в главе: «Добавить фото к
// главе» → лист «Фото главы» → фото встаёт обложкой главы и плиткой в списке; официант видит фото, кнопок нет; снять —
// плитка снова с номером), STORE (фото уроков и сотрудников после первого показа лежат на телефоне: после перезагрузки —
// ни одного запроса за фото, кружки и обложка есть сразу), FACE («Смена», «Я», «Команда», «График» — фото в кружках; своё
// фото: не картинка — отказ, выбор, кадр двигается и приближается, сохранить, видно везде, убрать), MOD (руководитель:
// «Фото команды» — убрать фото сотрудника; сотруднику списка не видно), INI (буквы в «Графике» — имя, потом фамилия),
// NO52 (сервер без этапа 52: всё как раньше, буквы; владельцу — лист с подсказкой про файл этапа), NARROW (320 px, обе темы).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v158.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5580, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v158";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const pub = (f) => readFileSync(fileURLToPath(new URL("../../public/reference/" + f, import.meta.url)));
const PHOTO = { name: "portrait.jpg", mimeType: "image/jpeg", buffer: pub("wine_present.jpg") };       // «фото» для кружка и главы
const PHOTO2 = { name: "second.jpg", mimeType: "image/jpeg", buffer: pub("school_french_2.jpg") };
const NOT_IMAGE = { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("это не фото") };
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

// страница готова: заставка ушла, всплывающие «моменты» и окно Telegram демо закрываются сами
async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1300);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
}
async function open({ who = "anna", light = false, width = 390, height = 844, hour = 11, no52 = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n]) => { localStorage.clear(); localStorage.setItem("__demo_who", w); if (n) localStorage.setItem("__demo_no52", "1"); }, [who, no52]);
  if (hour !== null) await page.evaluate((h) => { const real = performance.timeOrigin + performance.now(); const d = new Date();
    localStorage.setItem("__demo_t", JSON.stringify({ off: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0).getTime() - real, at: real })); }, hour);
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
// другой человек демо в том же окне: сервер (и фото на телефоне) остаются
const switchWho = async (page, errs, who) => { await page.evaluate((w) => { localStorage.setItem("__demo_who", w); localStorage.removeItem("__demo_me"); }, who); await page.reload({ waitUntil: "load" }); await ready(page, errs); };
const reload = async (page, errs) => { await page.reload({ waitUntil: "load" }); await ready(page, errs); };
const nav = async (page, s, ms = 1800) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms);
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await page.waitForTimeout(250); };
const lesson = async (page, id, ms = 2200) => { await page.evaluate((x) => window.__saLesson && window.__saLesson(x), id); await page.waitForTimeout(ms); };
const toEnd = async (page) => { for (let i = 0; i < 30; i++) { if (await page.locator("[data-tb-check], button:has-text('Урок пройден')").count()) break; const n = page.locator("span[aria-label='Следующая карточка']"); if (!(await n.count())) break; await n.first().click(); await page.waitForTimeout(260); } };
const bottom = async (page) => { await page.evaluate(() => { const r = document.getElementById("root"); const s = r && r.scrollHeight > r.clientHeight + 5 ? r : document.scrollingElement; s.scrollTop = s.scrollHeight; }); await page.waitForTimeout(350); };
const overflowX = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });
// запросы к серверу: сколько и каких ушло после этой отметки (демо перехватывает fetch — встаём перед ним)
const spy = (page) => page.evaluate(() => {
  if (window.__rpcLog) { window.__rpcLog.length = 0; return; }
  window.__rpcLog = [];
  const f = window.fetch;
  window.fetch = function (input, init) {
    try { const m = String(typeof input === "string" ? input : (input && input.url) || "").match(/\/rpc\/([a-z_0-9]+)/);
      if (m) { let b = null; try { b = JSON.parse((init && init.body) || "{}"); } catch (e) { /* */ } window.__rpcLog.push([m[1], b && Array.isArray(b.p_ids) ? b.p_ids.length : 0, !!(b && b.p_full)]); } } catch (e) { /* */ }
    return f.apply(this, arguments);
  };
});
const rpcs = (page, fn) => page.evaluate((n) => (window.__rpcLog || []).filter((x) => x[0] === n), fn);
// что лежит на телефоне (IndexedDB «sa_photos»): ключи превью и целых фото; базы ещё нет — null
const onPhone = (page) => page.evaluate(async () => {
  if (indexedDB.databases) { const all = await indexedDB.databases(); if (!all.some((d) => d.name === "sa_photos")) return null; }
  return await new Promise((res) => { const rq = indexedDB.open("sa_photos"); rq.onerror = () => res(null);
    rq.onsuccess = () => { const db = rq.result; if (!db.objectStoreNames.contains("t")) { db.close(); res(null); return; } const tx = db.transaction(["t", "f"]); const out = {}; let n = 2;
      for (const s of ["t", "f"]) { const r = tx.objectStore(s).getAllKeys(); r.onsuccess = () => { out[s] = r.result.map(String); if (!--n) { db.close(); res(out); } }; } }; });
});
const faces = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => { const img = e.querySelector("img[data-face]"); const r = e.getBoundingClientRect();
  return { t: (e.textContent || "").trim(), face: img ? img.getAttribute("data-face") : "", ok: img ? img.naturalWidth > 0 && Math.abs(img.getBoundingClientRect().width - e.clientWidth) <= 2 : false, w: Math.round(r.width), round: getComputedStyle(img || e).borderRadius }; }), sel);
const myFaceOpen = async (page) => { await nav(page, "me"); await page.locator("[data-my-face]").click(); await page.waitForTimeout(700); };

// ── DONE ───────────────────────────────────────────────────────────────────────────────
if (want("DONE")) for (const light of [false, true]) {
  const tag = "DONE" + (light ? " (для чтения)" : "");
  const { ctx, page, errs } = await open({ who: "anna", light });
  await lesson(page, "s1-3"); await toEnd(page); await bottom(page);
  ok(tag + ": до нажатия строки нет", (await page.locator("[data-done-note]").count()) === 0);
  // нажимаем и смотрим в тот же миг (через четверть секунды бокал уже доливается)
  const first = await page.evaluate(async () => { const b = [...document.querySelectorAll("button")].filter((x) => /Урок пройден/.test(x.textContent || "")).pop(); b.click();
    await new Promise((r) => setTimeout(r, 40));
    const n = document.querySelector("[data-done-note]"); const w = n && n.querySelector("[data-emb='wine']"); return n ? { pct: w ? w.getAttribute("data-pct") : null } : null; });
  ok(tag + ": сразу после нажатия бокал ещё прежний (0), строка уже на месте", !!first && first.pct === "0", JSON.stringify(first));
  await page.waitForTimeout(1500); await bottom(page);
  const d = await page.evaluate(() => {
    const n = document.querySelector("[data-done-note]"); if (!n) return null;
    const btn = [...document.querySelectorAll("button")].find((b) => /Пройдено/.test(b.textContent || "")); const nr = n.getBoundingClientRect(), br = btn ? btn.getBoundingClientRect() : null;
    const g = n.querySelector("[data-done-goal]"), l = n.querySelector("[data-done-left]"), w = n.querySelector("[data-emb='wine']");
    const at = br ? document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2) : null;
    const veil = [...document.querySelectorAll("body *")].filter((e) => { const s = getComputedStyle(e); if (s.position !== "fixed" || e.closest("#demo-bar, #demo-tg")) return false; const r = e.getBoundingClientRect(); return r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9 && s.pointerEvents !== "none"; }).length;
    return { goal: g ? g.textContent : "", state: g ? g.getAttribute("data-done-goal") : "", left: l ? l.textContent.replace(/ /g, " ") : "", n: l ? Number(l.getAttribute("data-done-left")) : -1, pct: w ? w.getAttribute("data-pct") : "",
      under: !!br && nr.top >= br.bottom - 1, inside: nr.left >= 0 && nr.right <= innerWidth + 0.5, btnOnTop: !!btn && !!at && btn.contains(at), veil, color: getComputedStyle(g).color, role: n.getAttribute("role") };
  });
  ok(tag + ": «Цель дня: 1 из 2», бокал долился до половины", !!d && d.goal === "Цель дня: 1 из 2" && d.state === "going" && d.pct === "50", JSON.stringify(d));
  ok(tag + ": «До конца раздела N шагов» — число есть и слово согласовано", !!d && d.n > 0 && /^До конца раздела \d+ (шаг|шага|шагов)$/.test(d.left), JSON.stringify(d && d.left));
  ok(tag + ": строка под кнопкой «Далее», в ширину экрана; кнопка на месте и нажимается; шторок нет", !!d && d.under && d.inside && d.btnOnTop && d.veil === 0 && d.role === "status", JSON.stringify(d));
  await shot(page, "done-1" + (light ? "-light" : ""));
  // второй урок — цель дня выполнена
  await page.locator("button:has-text('Пройдено')").first().click(); await page.waitForTimeout(1800);
  await toEnd(page); await bottom(page);
  await page.locator("button:has-text('Урок пройден')").last().click(); await page.waitForTimeout(1700);
  const e = await page.evaluate(() => { const n = document.querySelector("[data-done-note]"); if (!n) return null; const g = n.querySelector("[data-done-goal]"), w = n.querySelector("[data-emb='wine']"), l = n.querySelector("[data-done-left]");
    return { goal: g.textContent, state: g.getAttribute("data-done-goal"), pct: w.getAttribute("data-pct"), spark: !!w.querySelector("[data-emb-spark]"), n: l ? Number(l.getAttribute("data-done-left")) : -1 }; });
  ok(tag + ": второй урок — «Цель дня есть», бокал полный, с искрой; остаток раздела уменьшился", !!e && e.goal === "Цель дня есть" && e.state === "reached" && e.pct === "100" && e.spark && e.n === d.n - 1, JSON.stringify(e));
  await shot(page, "done-2" + (light ? "-light" : ""));
  ok(tag + ": без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── REF ────────────────────────────────────────────────────────────────────────────────
const tiles = (page) => page.evaluate(() => [...document.querySelectorAll("[data-ref-chapter]")].map((row) => { const t = row.querySelector("[data-ref-tile]"), r = t.getBoundingClientRect(), rr = row.getBoundingClientRect(); const img = t.querySelector("img");
  const lab = [...row.querySelectorAll("div")].map((x) => x.textContent.trim()).find((x) => /^Глава( \d+)?$|^Фото-тест$/.test(x)) || "";
  return { id: row.getAttribute("data-ref-chapter"), kind: t.getAttribute("data-ref-tile"), w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left - rr.left), img: img ? (img.complete && img.naturalWidth > 0) : null, svg: !!t.querySelector("svg"), num: t.textContent.trim(), lab, inRow: r.top >= rr.top && r.bottom <= rr.bottom }; }));
const openSection = async (page, sec) => { await nav(page, "home", 500); await nav(page, "reference"); await page.locator(`[data-ref-card="${sec}"]`).first().click(); await page.waitForTimeout(1300); };
if (want("REF")) for (const light of [false, true]) {
  const tag = "REF" + (light ? " (для чтения)" : "");
  const { ctx, page, errs } = await open({ who: "anna", light });
  await openSection(page, "serving");
  const s = await tiles(page);
  ok(tag + ": «Сервировка» — номер, четыре рисунка, фото", s.map((x) => x.kind).join(",") === "num,art,art,art,art,photo", s.map((x) => x.kind).join(","));
  ok(tag + ": плитка 52 × 52, у всех строк на одном месте и внутри строки", s.every((x) => x.w === 52 && x.h === 52 && x.left === s[0].left && x.inRow), JSON.stringify(s.map((x) => [x.w, x.h, x.left, x.inRow])));
  ok(tag + ": фото загрузилось, у рисунков — рисунок, у главы без картинки — номер", s[5].img === true && s.slice(1, 5).every((x) => x.svg && !x.num) && s[0].num === "1", JSON.stringify(s.map((x) => [x.kind, x.img, x.svg, x.num])));
  ok(tag + ": с картинкой номер уходит в подпись («Глава 2»), без картинки — просто «Глава»", s[0].lab === "Глава" && s[1].lab === "Глава 2" && s[5].lab === "Глава 6", JSON.stringify(s.map((x) => x.lab)));
  await shot(page, "ref-serving" + (light ? "-light" : ""));
  await openSection(page, "wine");
  const w = await tiles(page);
  ok(tag + ": «Вина» — фото в трёх главах, рисунок в одной, остальные с номером", w.map((x) => x.kind).join(",") === "photo,num,art,num,photo,photo,num,num" && w.filter((x) => x.kind === "photo").every((x) => x.img === true), w.map((x) => x.kind + ":" + x.img).join(","));
  await openSection(page, "coffee");
  const c = await tiles(page);
  ok(tag + ": «Кофе» — три рисунка и номера", c.map((x) => x.kind).join(",") === "num,art,art,art,num,num,num", c.map((x) => x.kind).join(","));
  ok(tag + ": глава открывается по строке, как раньше", await (async () => { await page.locator("[data-ref-chapter='cof-espresso']").click(); await page.waitForTimeout(900); return /Эспрессо: эталон и настройка/.test(await page.evaluate(() => document.body.innerText)) && (await page.locator("[data-ref-chapter]").count()) === 0; })());
  ok(tag + ": официанту в главе кнопок фото нет", (await page.locator("[data-lp-add], [data-lp-edit]").count()) === 0);
  ok(tag + ": без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── CHAP ───────────────────────────────────────────────────────────────────────────────
if (want("CHAP")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  await openSection(page, "serving");
  await page.locator("[data-ref-chapter='srv-basics']").click(); await page.waitForTimeout(900);
  const add = page.locator("[data-lp-add]");
  ok("CHAP: руководителю в главе без фото — «Добавить фото к главе»", (await add.count()) === 1 && /Добавить фото к главе/.test(await add.textContent()), await add.count());
  await add.click(); await page.waitForTimeout(600);
  const sh = await page.evaluate(() => { const s = document.querySelector("[data-lp-sheet] [role=dialog]"); return s ? { kind: s.getAttribute("data-lp-kind"), label: s.getAttribute("aria-label"), text: s.innerText.replace(/\s+/g, " ") } : null; });
  ok("CHAP: лист «Фото главы» — название главы и подсказка про плитку в списке", !!sh && sh.kind === "chapter" && sh.label === "Фото главы" && /Основы сервировки/.test(sh.text) && /плиткой в списке глав/.test(sh.text), JSON.stringify(sh));
  await page.locator("[data-lp-pick] input").setInputFiles(PHOTO); await page.waitForTimeout(2200);
  const cover = await page.evaluate(() => { const c = document.querySelector("[data-lp-cover]"); const img = c && c.querySelector("img"); return c ? { has: !!img && img.naturalWidth > 0, sheet: !!document.querySelector("[data-lp-sheet]"), edit: !!c.querySelector("[data-lp-edit]") } : null; });
  ok("CHAP: фото встало обложкой главы, лист закрылся, у руководителя — кнопка «сменить»", !!cover && cover.has && !cover.sheet && cover.edit, JSON.stringify(cover));
  await shot(page, "chap-cover");
  await page.locator("[data-lens='back']").first().click(); await page.waitForTimeout(900);
  let t = await tiles(page);
  ok("CHAP: в списке глав у «Основ сервировки» — своё фото, подпись «Глава 1»", t[0].kind === "own" && t[0].img === true && t[0].lab === "Глава 1", JSON.stringify(t[0]));
  await shot(page, "chap-list");
  await switchWho(page, errs, "anna");
  await openSection(page, "serving");
  t = await tiles(page);
  ok("CHAP: официант видит то же фото на плитке", t[0].kind === "own" && t[0].img === true, JSON.stringify(t[0]));
  await page.locator("[data-ref-chapter='srv-basics']").click(); await page.waitForTimeout(1200);
  const a = await page.evaluate(() => ({ cover: !!document.querySelector("[data-lp-cover] img"), btn: document.querySelectorAll("[data-lp-add], [data-lp-edit]").length }));
  ok("CHAP: и в главе — обложку, без кнопок", a.cover && a.btn === 0, JSON.stringify(a));
  await switchWho(page, errs, "maria");
  await openSection(page, "serving");
  await page.locator("[data-ref-chapter='srv-basics']").click(); await page.waitForTimeout(1200);
  await page.locator("[data-lp-edit]").click(); await page.waitForTimeout(500);
  await page.locator("[data-lp-drop]").click(); await page.waitForTimeout(300);
  ok("CHAP: «Убрать фото» переспрашивает словами про главу", /Да, убрать фото у главы/.test(await page.locator("[data-lp-drop]").textContent()));
  await page.locator("[data-lp-drop]").click(); await page.waitForTimeout(1500);
  await page.locator("[data-lens='back']").first().click(); await page.waitForTimeout(900);
  t = await tiles(page);
  ok("CHAP: фото сняли — плитка снова с номером, подпись «Глава»", t[0].kind === "num" && t[0].num === "1" && t[0].lab === "Глава", JSON.stringify(t[0]));
  ok("CHAP: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── STORE ──────────────────────────────────────────────────────────────────────────────
if (want("STORE")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  ok("STORE: новый телефон — фото на нём ещё нет", ((await onPhone(page)) || { t: [] }).t.length === 0);
  await spy(page);
  await nav(page, "shift", 2400);
  const s1 = await rpcs(page, "staff_photo");
  const m1 = await faces(page, "[data-shift-mates] [data-mate]");
  ok("STORE: «Смена» в первый раз — превью коллег одним запросом", s1.length === 1 && s1[0][1] >= 2 && s1[0][2] === false, JSON.stringify(s1));
  ok("STORE: фото в кружках", m1.filter((x) => x.face && x.ok).length === 2, JSON.stringify(m1));
  await nav(page, "home", 2600);
  const cov1 = await page.evaluate(() => { const i = document.querySelector(".tbm-cover img"); return i ? i.naturalWidth > 0 : null; });
  const l1 = await rpcs(page, "lesson_photo");
  ok("STORE: обложка раздела в первый раз — с сервера", cov1 === true && l1.length >= 1, JSON.stringify([cov1, l1.length]));
  await page.waitForTimeout(600);
  const ph = await onPhone(page);
  ok("STORE: после показа фото лежат на телефоне: превью коллег и фото урока", !!ph && ph.t.filter((k) => k.startsWith("sp:")).length >= 2 && ph.t.some((k) => k.startsWith("lp:")) && ph.f.some((k) => k.startsWith("lp:")), JSON.stringify(ph));
  await reload(page, errs);
  await spy(page);
  await nav(page, "shift", 700);
  const m2 = await faces(page, "[data-shift-mates] [data-mate]");
  ok("STORE: после перезапуска кружки с фото сразу", m2.filter((x) => x.face && x.ok).length === 2, JSON.stringify(m2));
  await nav(page, "home", 900);
  const cov2 = await page.evaluate(() => { const c = document.querySelector(".tbm-cover"); const i = c && c.querySelector("img"); return c ? { img: !!i && i.naturalWidth > 0, skel: !!c.querySelector(".sa-skel") } : null; });
  ok("STORE: и обложка раздела сразу, без серой заглушки", !!cov2 && cov2.img && !cov2.skel, JSON.stringify(cov2));
  await page.waitForTimeout(1500);
  const again = [await rpcs(page, "staff_photo"), await rpcs(page, "lesson_photo")];
  ok("STORE: за фото после перезапуска — ни одного запроса", again[0].length === 0 && again[1].length === 0, JSON.stringify(again));
  ok("STORE: списки (у кого фото) приложение по-прежнему сверяет с сервером", (await rpcs(page, "staff_photos")).length <= 1);
  ok("STORE: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── FACE ───────────────────────────────────────────────────────────────────────────────
if (want("FACE")) for (const light of [false, true]) {
  const tag = "FACE" + (light ? " (для чтения)" : "");
  const { ctx, page, errs } = await open({ who: "anna", light });
  await nav(page, "shift", 2400);
  const m = await faces(page, "[data-shift-mates] [data-mate]");
  ok(tag + ": «Смена» — у Марии и Дарьи фото в кружках, круглые, во весь кружок; «+2» — без фото", m.length === 3 && m[0].face === "u-maria" && m[0].ok && m[1].face === "e-darya" && m[1].ok && !m[2].face && m[2].t === "+2", JSON.stringify(m));
  ok(tag + ": буквы под фото остаются (их читает экранный диктор, они же — пока фото грузится)", m[0].t === "МК" && m[1].t === "ДЛ");
  await shot(page, "face-shift" + (light ? "-light" : ""));
  await nav(page, "me");
  const mark = await page.evaluate(() => { const k = document.querySelector("[data-hub-mark='avatar']"); const b = k && k.querySelector("[data-my-face]"), badge = k && k.querySelector("[data-my-face-badge]"); const r = k.getBoundingClientRect(), br = badge ? badge.getBoundingClientRect() : null;
    return { state: b ? b.getAttribute("data-my-face") : "", label: b ? b.getAttribute("aria-label") : "", w: Math.round(r.width), badge: br ? Math.round(br.width) : 0, corner: br ? br.right > r.right - 6 && br.bottom > r.bottom - 6 : false, txt: k.textContent.trim(), tap: b ? Math.round(b.getBoundingClientRect().width) : 0 }; });
  ok(tag + ": «Я» — кружок с буквами 44 px, в углу маленький фотоаппарат; кнопка «Добавить своё фото» не меньше 44 px", mark.state === "add" && mark.label === "Добавить своё фото" && mark.w === 44 && mark.badge === 20 && mark.corner && mark.txt === "АС" && mark.tap >= 44, JSON.stringify(mark));
  await page.locator("[data-my-face]").click(); await page.waitForTimeout(700);
  const s0 = await page.evaluate(() => { const s = document.querySelector("[data-sp-sheet] [role=dialog]"); return s ? { mode: document.querySelector("[data-sp-sheet]").getAttribute("data-sp-sheet"), text: s.innerText.replace(/\s+/g, " "), now: s.querySelector("[data-sp-now]").getAttribute("data-sp-now"), team: !!s.querySelector("[data-sp-team]") } : null; });
  ok(tag + ": лист «Моё фото» — имя, кто увидит фото, «Выбрать фото»; «Фото команды» у сотрудника нет", !!s0 && s0.mode === "me" && s0.now === "none" && /Анна Смирнова/.test(s0.text) && /увидят коллеги по сети/.test(s0.text) && /Выбрать фото/.test(s0.text) && !/Убрать фото/.test(s0.text) && !s0.team, JSON.stringify(s0));
  await page.locator("[data-sp-pick] input").setInputFiles(NOT_IMAGE); await page.waitForTimeout(600);
  ok(tag + ": не картинка — понятный отказ, лист на месте", /Это не картинка\. Выбери фото\./.test(await page.locator("[data-sp-msg]").textContent()) && (await page.locator("[data-sp-sheet='me']").count()) === 1);
  await page.locator("[data-sp-pick] input").setInputFiles(PHOTO); await page.waitForTimeout(1500);
  const geo = () => page.evaluate(() => { const st = document.querySelector("[data-sp-stage]"); if (!st) return null; const i = st.querySelector("img"), r = st.getBoundingClientRect(), ir = i.getBoundingClientRect();
    return { size: Math.round(r.width), round: getComputedStyle(st).borderRadius, iw: Math.round(ir.width), ih: Math.round(ir.height), left: Math.round(ir.left - r.left), top: Math.round(ir.top - r.top), covers: ir.left <= r.left + 0.5 && ir.top <= r.top + 0.5 && ir.right >= r.right - 0.5 && ir.bottom >= r.bottom - 0.5, zoom: document.querySelector("[data-sp-zoom]").value }; });
  const g0 = await geo();
  ok(tag + ": кадр — круг, фото закрывает его целиком, ползунок на 1", !!g0 && g0.round === "50%" && g0.size >= 180 && g0.covers && g0.zoom === "1" && (await page.locator("[data-sp-sheet='crop']").count()) === 1, JSON.stringify(g0));
  const bb = await page.locator("[data-sp-stage]").boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + bb.width / 2 - 20, bb.y + bb.height / 2 - 30, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
  const g1 = await geo();
  ok(tag + ": фото едет за пальцем и не открывает пустоту", g1.covers && (g1.left !== g0.left || g1.top !== g0.top), JSON.stringify([g0, g1]));
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + bb.width / 2 + 900, bb.y + bb.height / 2 + 900, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(200);
  const g2 = await geo();
  ok(tag + ": дотянули до края — фото упирается, круг закрыт", g2.covers && g2.left === 0 && g2.top === 0, JSON.stringify(g2));
  await page.locator("[data-sp-zoom]").fill("2"); await page.waitForTimeout(250);
  const g3 = await geo();
  ok(tag + ": ползунок приближает вдвое", g3.covers && Math.abs(g3.iw - g2.iw * 2) <= 2, JSON.stringify([g2.iw, g3.iw]));
  await shot(page, "face-crop" + (light ? "-light" : ""));
  await spy(page);
  await page.locator("[data-sp-save]").click(); await page.waitForTimeout(1800);
  const set = await rpcs(page, "staff_photo_set");
  const after = await page.evaluate(() => { const k = document.querySelector("[data-hub-mark='avatar']"); const i = k.querySelector("img[data-face]"), b = k.querySelector("[data-my-face]"); return { sheet: !!document.querySelector("[data-sp-sheet]"), face: i ? i.getAttribute("data-face") : "", loaded: !!i && i.naturalWidth === 160 && i.naturalHeight === 160, state: b.getAttribute("data-my-face"), badge: !!k.querySelector("[data-my-face-badge]") }; });
  ok(tag + ": «Сохранить» — один запрос, лист закрылся, в кружке «Я» своё фото (превью 160 × 160), фотоаппарата больше нет", set.length === 1 && !after.sheet && after.face === "e-anna" && after.loaded && after.state === "photo" && !after.badge, JSON.stringify([set, after]));
  const ph = await onPhone(page);
  ok(tag + ": своё фото сразу лежит на телефоне (превью и целое)", !!ph && ph.t.some((k) => k.startsWith("sp:e-anna|")) && ph.f.some((k) => k.startsWith("sp:e-anna|")), JSON.stringify(ph));
  await nav(page, "teamHub", 2200);
  const lead = await faces(page, "[data-leader] > div:first-child");
  ok(tag + ": «Команда» — у лидеров фото в медальонах, и у Анны своё", lead.length === 3 && lead.every((x) => x.face && x.ok) && lead.some((x) => x.face === "e-anna"), JSON.stringify(lead));
  await shot(page, "face-team" + (light ? "-light" : ""));
  await nav(page, "schedule", 2600);
  const hero = await faces(page, "[data-hero-lead-disc]");
  ok(tag + ": «График» — у старшего смены фото, буквы под ним «МК»", hero.length === 1 && hero[0].face === "u-maria" && hero[0].ok && hero[0].t === "МК", JSON.stringify(hero));
  await page.locator("[data-hero-mates]").first().click(); await page.waitForTimeout(900);
  const sheetFaces = await faces(page, "[data-sheet-face] > div:first-child > div:first-child");
  ok(tag + ": лист «Кто со мной» — фото у тех, у кого оно есть, у остальных буквы «имя, потом фамилия»", sheetFaces.length >= 3 && sheetFaces.filter((x) => x.face && x.ok).length >= 2 && sheetFaces.some((x) => !x.face && x.t === "КМ"), JSON.stringify(sheetFaces));
  await shot(page, "face-schedule" + (light ? "-light" : ""));
  // сменить и убрать
  await myFaceOpen(page);
  const s1 = await page.evaluate(() => { const s = document.querySelector("[data-sp-sheet] [role=dialog]"); const i = s.querySelector("[data-sp-now] img"); return { now: s.querySelector("[data-sp-now]").getAttribute("data-sp-now"), big: !!i && i.naturalWidth >= 160, text: s.innerText.replace(/\s+/g, " ") }; });
  ok(tag + ": лист со своим фото — «Сменить фото» и «Убрать фото»", s1.now === "photo" && s1.big && /Сменить фото/.test(s1.text) && /Убрать фото/.test(s1.text), JSON.stringify(s1));
  await page.locator("[data-sp-pick] input").setInputFiles(PHOTO2); await page.waitForTimeout(1500);
  await page.locator("[data-sp-save]").click(); await page.waitForTimeout(1800);
  const ph2 = await onPhone(page);
  ok(tag + ": сменили фото — на телефоне осталась одна версия своего", ph2.t.filter((k) => k.startsWith("sp:e-anna|")).length === 1 && ph2.f.filter((k) => k.startsWith("sp:e-anna|")).length === 1, JSON.stringify(ph2));
  await myFaceOpen(page);
  await page.locator("[data-sp-drop]").click(); await page.waitForTimeout(300);
  const sure = await page.locator("[data-sp-drop]").textContent();
  await page.locator("[data-sp-drop]").click(); await page.waitForTimeout(1500);
  const gone = await page.evaluate(() => { const k = document.querySelector("[data-hub-mark='avatar']"); return { sheet: !!document.querySelector("[data-sp-sheet]"), img: !!k.querySelector("img"), state: k.querySelector("[data-my-face]").getAttribute("data-my-face"), badge: !!k.querySelector("[data-my-face-badge]") }; });
  ok(tag + ": «Убрать фото» переспрашивает и убирает: снова буквы и фотоаппарат", /Да, убрать моё фото/.test(sure) && !gone.sheet && !gone.img && gone.state === "add" && gone.badge, JSON.stringify([sure, gone]));
  const ph3 = await onPhone(page);
  ok(tag + ": и с телефона своё фото убрано", ph3.t.filter((k) => k.startsWith("sp:e-anna|")).length === 0 && ph3.f.filter((k) => k.startsWith("sp:e-anna|")).length === 0, JSON.stringify(ph3));
  ok(tag + ": без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── MOD ────────────────────────────────────────────────────────────────────────────────
if (want("MOD")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  await nav(page, "me");
  const mine = await page.evaluate(() => { const k = document.querySelector("[data-hub-mark='avatar']"); const i = k.querySelector("img[data-face]"); return { face: i ? i.getAttribute("data-face") : "", state: k.querySelector("[data-my-face]").getAttribute("data-my-face") }; });
  ok("MOD: у менеджера в «Я» своё фото", mine.face === "u-maria" && mine.state === "photo", JSON.stringify(mine));
  await page.locator("[data-my-face]").click(); await page.waitForTimeout(700);
  const team = page.locator("[data-sp-team]");
  ok("MOD: в листе — «Фото команды» и сколько их (пятеро, без себя)", (await team.count()) === 1 && (await team.getAttribute("data-sp-team")) === "5", await team.count());
  await team.click(); await page.waitForTimeout(600);
  const rows = await page.evaluate(() => [...document.querySelectorAll("[data-sp-row]")].map((r) => ({ id: r.getAttribute("data-sp-row"), name: r.innerText.replace(/\s+/g, " "), img: !!r.querySelector("img[data-face]") })));
  ok("MOD: список — пять человек своего заведения с фото и кнопкой «Убрать», себя нет", rows.length === 5 && rows.every((r) => r.img && /Убрать/.test(r.name)) && !rows.some((r) => r.id === "u-maria") && (await page.locator("[data-sp-sheet='team']").count()) === 1, JSON.stringify(rows));
  await shot(page, "mod-list");
  const drop = page.locator("[data-sp-row='e-darya'] [data-sp-drop]");
  await drop.click(); await page.waitForTimeout(250);
  ok("MOD: «Убрать» переспрашивает", /Точно убрать/.test(await drop.textContent()) && (await page.locator("[data-sp-row]").count()) === 5);
  await drop.click(); await page.waitForTimeout(1500);
  ok("MOD: фото Дарьи убрано — в списке четверо, лист открыт", (await page.locator("[data-sp-row]").count()) === 4 && (await page.locator("[data-sp-row='e-darya']").count()) === 0 && (await page.locator("[data-sp-sheet='team']").count()) === 1);
  await page.locator("[data-sp-back]").click(); await page.waitForTimeout(400);
  ok("MOD: назад — снова «Моё фото», в строке уже 4", (await page.locator("[data-sp-sheet='me']").count()) === 1 && (await page.locator("[data-sp-team]").getAttribute("data-sp-team")) === "4");
  await page.locator("[data-sp-sheet] [data-lens-x]").click(); await page.waitForTimeout(400);
  await nav(page, "shift", 2200);
  const m = await faces(page, "[data-shift-mates] [data-mate]");
  ok("MOD: в «Смене» у Дарьи снова буквы", m.some((x) => x.t === "ДЛ" && !x.face), JSON.stringify(m));
  await switchWho(page, errs, "anna");
  await nav(page, "shift", 2200);
  const m2 = await faces(page, "[data-shift-mates] [data-mate]");
  ok("MOD: и у Анны — фото Марии есть, у Дарьи буквы", m2[0].face === "u-maria" && m2.some((x) => x.t === "ДЛ" && !x.face), JSON.stringify(m2));
  ok("MOD: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── INI ────────────────────────────────────────────────────────────────────────────────
if (want("INI")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  await spy(page);
  await nav(page, "schedule", 2800);
  const row = await page.evaluate(() => [...document.querySelectorAll("span[title]")].filter((s) => /^[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+/.test(s.getAttribute("title") || "") && s.getBoundingClientRect().width > 20 && s.getBoundingClientRect().width < 40)
    .map((s) => ({ who: s.getAttribute("title").split(",")[0], t: (s.textContent || "").trim().slice(0, 2), face: !!s.querySelector("img[data-face]") })));
  const want2 = { "Ким Мария": "МК", "Смирнова Анна": "АС", "Лебедева Дарья": "ДЛ", "Миронова Ксения": "КМ", "Орлов Пётр": "ПО" };
  ok("INI: «График» у руководителя — в кружках «Сегодня» буквы «имя, потом фамилия»", row.length >= 4 && row.every((x) => !want2[x.who] || want2[x.who] === x.t), JSON.stringify(row));
  ok("INI: «Ким Мария» теперь «МК», а «КМ» — Ксения Миронова", row.some((x) => x.who === "Ким Мария" && x.t === "МК") && row.some((x) => x.who === "Миронова Ксения" && x.t === "КМ"), JSON.stringify(row));
  ok("INI: у кого есть фото — оно в кружке, у Анны и Ксении буквы", row.filter((x) => x.face).length >= 3 && row.filter((x) => !x.face).some((x) => x.who === "Смирнова Анна"), JSON.stringify(row));
  const sp1 = await rpcs(page, "staff_photo");
  ok("INI: все фото графика — одним запросом", sp1.length === 1 && sp1[0][1] >= 3, JSON.stringify(sp1));
  await shot(page, "ini-schedule");
  ok("INI: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── NO52 ───────────────────────────────────────────────────────────────────────────────
if (want("NO52")) {
  const { ctx, page, errs } = await open({ who: "anna", no52: true });
  await spy(page);
  await nav(page, "shift", 2200);
  const m = await faces(page, "[data-shift-mates] [data-mate]");
  ok("NO52: сервер без этапа 52 — «Смена» как раньше, буквы в кружках", m.length === 3 && m.every((x) => !x.face) && m[0].t === "МК", JSON.stringify(m));
  await nav(page, "me");
  const mark = await page.evaluate(() => { const k = document.querySelector("[data-hub-mark='avatar']"); return { btn: !!k.querySelector("[data-my-face]"), badge: !!k.querySelector("[data-my-face-badge]"), txt: k.textContent.trim(), hidden: k.getAttribute("aria-hidden") }; });
  ok("NO52: сотруднику в «Я» — кружок с буквами без кнопки и без фотоаппарата", !mark.btn && !mark.badge && mark.txt === "АС", JSON.stringify(mark));
  await nav(page, "teamHub", 2000); await nav(page, "schedule", 2400);
  ok("NO52: за фото приложение сервер не дёргает", (await rpcs(page, "staff_photo")).length === 0 && (await rpcs(page, "staff_photos")).length <= 1, JSON.stringify(await rpcs(page, "staff_photos")));
  ok("NO52: сотрудник — без ошибок страницы", !errs.length, errs.join(" | "));
  await switchWho(page, errs, "roman");
  await nav(page, "me");
  const own = page.locator("[data-my-face]");
  ok("NO52: владельцу кружок нажимается", (await own.count()) === 1);
  await own.click(); await page.waitForTimeout(700);
  const sh = await page.evaluate(() => { const s = document.querySelector("[data-sp-sheet] [role=dialog]"); return s ? s.innerText.replace(/\s+/g, " ") : ""; });
  ok("NO52: в листе — какой файл запустить на сервере, кнопки выбора нет", /supabase-stage52-staff-photos\.sql/.test(sh) && !/Выбрать фото/.test(sh), sh);
  await shot(page, "no52-owner");
  ok("NO52: владелец — без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── NARROW ─────────────────────────────────────────────────────────────────────────────
if (want("NARROW")) for (const light of [false, true]) {
  const tag = "NARROW 320" + (light ? " (для чтения)" : "");
  const { ctx, page, errs } = await open({ who: "anna", light, width: 320, height: 640 });
  await lesson(page, "s1-3"); await toEnd(page); await bottom(page);
  await page.locator("button:has-text('Урок пройден')").last().click(); await page.waitForTimeout(1500); await bottom(page);
  const d = await page.evaluate(() => { const n = document.querySelector("[data-done-note]"); const r = n.getBoundingClientRect(); return { in: r.left >= 0 && r.right <= innerWidth + 0.5, h: Math.round(r.height), parts: [...n.children].map((c) => { const q = c.getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth + 0.5; }) }; });
  ok(tag + ": строка после урока — в ширину экрана (в две строки, если не влезла)", d.in && d.parts.every(Boolean) && (await overflowX(page)) <= 0, JSON.stringify(d));
  await openSection(page, "wine");
  const t = await tiles(page);
  ok(tag + ": список глав — плитки 52 px, строки в ширину экрана", t.every((x) => x.w === 52 && x.inRow) && (await overflowX(page)) <= 0, JSON.stringify(t.map((x) => [x.w, x.inRow])));
  await shot(page, "narrow-ref" + (light ? "-light" : ""));
  await myFaceOpen(page);
  const s = await page.evaluate(() => { const d2 = document.querySelector("[data-sp-sheet] [role=dialog]"); const r = d2.getBoundingClientRect(); return { in: r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, top: Math.round(r.top) }; });
  ok(tag + ": лист «Моё фото» помещается", s.in && s.top >= 0, JSON.stringify(s));
  await page.locator("[data-sp-pick] input").setInputFiles(PHOTO); await page.waitForTimeout(1500);
  const c = await page.evaluate(() => { const d2 = document.querySelector("[data-sp-sheet] [role=dialog]"), st = document.querySelector("[data-sp-stage]"), sv = document.querySelector("[data-sp-save]"); const r = d2.getBoundingClientRect(), q = st.getBoundingClientRect(), b = sv.getBoundingClientRect();
    return { stage: Math.round(q.width), stageIn: q.left >= 0 && q.right <= innerWidth, top: Math.round(r.top), saveIn: b.bottom <= innerHeight + 0.5 || d2.scrollHeight > d2.clientHeight, scroll: d2.scrollHeight > d2.clientHeight + 1 }; });
  ok(tag + ": кадр — круг не меньше 180 px, целиком на экране; «Сохранить» достижима", c.stage >= 180 && c.stageIn && c.top >= 0 && c.saveIn && (await overflowX(page)) <= 0, JSON.stringify(c));
  await shot(page, "narrow-crop" + (light ? "-light" : ""));
  await page.locator("[data-sp-save]").scrollIntoViewIfNeeded(); await page.locator("[data-sp-save]").click(); await page.waitForTimeout(1800);
  ok(tag + ": сохранилось", (await page.locator("[data-my-face='photo']").count()) === 1);
  await nav(page, "shift", 2000);
  const m = await page.evaluate(() => { const b = document.querySelector("[data-shift-mates]"); const r = b.getBoundingClientRect(), h = b.parentElement.getBoundingClientRect(); return { in: r.left >= h.left - 0.5 && r.right <= h.right + 0.5, n: b.querySelectorAll("img[data-face]").length }; });
  ok(tag + ": «Смена» — кружки с фото внутри карточки", m.in && m.n === 2 && (await overflowX(page)) <= 0, JSON.stringify(m));
  ok(tag + ": без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log("итог: " + pass + " прошло, " + fail + " упало");
process.exit(fail ? 1 : 0);
