// e2e v168 (Доп. 493): редактор справочника, часть вторая — ассистент под текстом главы. В браузере, на демо целиком
// (tools/claude/demo-app/build.mjs). Модели в демо нет: «ассистент» собирает ответ из присланного текста, а проверка
// запроса и разбор ответа — те же, что на сервере (lib/ref-ai.js). sessionStorage.__e2e_ai: "fail" — ассистент не
// ответил, "drop" — «модель» потеряла картинки и выдумала свою.
//   PANEL — блок «Ассистент» в новой главе: четыре кнопки, без текста «Улучшить» и «Сократить» закрыты;
//   TOPIC — «Глава по теме»: тема из названия, предупреждение, ответ виден как глава, «Взять в главу», запись, сотрудник;
//   DOC   — «Глава из материала»: заменить или добавить в конец, своё название не затирается, «Вернуть прежний текст»;
//   FIX   — «Улучшить» и «Сократить»: вся глава и выделенный фрагмент, что ушло на сервер;
//   SAFE  — потерянные картинки возвращаются в текст, фото на сервере остаётся; новая глава вместо прежнего текста —
//           его картинки переносятся в конец; отказ ассистента; длинный текст;
//   LOOK  — светлая тема и 360 px: блок не вылезает, шрифт не мельче 10.5 px.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_ONLY="TOPIC FIX"] node e2e-v168.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5668, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v168";
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
const BASE_CARDS = ["serving", "wine", "coffee", "barcard"];
// «Команда»: группа «Управление» свёрнута кнопкой — раскрыть и вернуть подписи её строк
async function management(page) {
  await nav(page, "teamHub", "[data-hub-group]");
  if (await has(page, "[data-hub-group='Управление'][data-hub-open='0']")) await tap(page, "[data-hub-toggle='Управление']");
  await page.waitForTimeout(350);
  return txt(page, "[data-hub-group='Управление']");
}

// что редактор отправил ассистенту: запись запросов в странице
const spy = (page) => page.evaluate(() => { if (window.__aiSent) return; window.__aiSent = []; const f = window.fetch; window.fetch = (u, i) => { if (/lesson-assist/.test(String(u))) { try { window.__aiSent.push(JSON.parse(i.body)); } catch (e) {} } return f(u, i); }; });
const sent = (page) => page.evaluate(() => window.__aiSent || []);
const val = (page, sel) => page.inputValue(sel);
const result = async (page) => { await page.waitForSelector("[data-ra-result]", { timeout: 15000 }); await page.waitForTimeout(250); };
const setSel = (page, from, to) => page.evaluate(([a, b]) => { const t = document.querySelector("[data-re-ch-body]"); const v = t.value; const s = a == null ? 0 : v.indexOf(a), e = b == null ? s : v.indexOf(b) + b.length; t.focus(); t.setSelectionRange(s, e); }, [from, to]);
async function newChapter(page, sec = "coffee") {
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='" + sec + "']");
  await tap(page, "[data-re-new-ch]");
  await page.waitForSelector("[data-ra]");
  await spy(page);
}
const LINES = "Раф готовим на сливках десять процентов, это важно для вкуса.\n[img:espresso_cup]\nСироп добавляем до взбивания, иначе он не смешается.\nПодаём в бокале айриш на блюдце с ложкой.\nЕщё одно правило про температуру подачи напитка.";

// ── PANEL ──────────────────────────────────────────────────────────────────────────────────────────────
if (on("PANEL")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await newChapter(page);
  same("PANEL: кнопки ассистента (пятая, «Проверить факты», пришла в v169)", await attrs(page, "data-ra-btn"), ["doc", "topic", "improve", "shorten", "check"]);
  ok("PANEL: в пустой главе «Улучшить» и «Сократить» закрыты, главы открыты", await page.evaluate(() => { const d = (k) => document.querySelector("[data-ra-btn='" + k + "']").disabled; return d("improve") && d("shorten") && !d("doc") && !d("topic"); }));
  ok("PANEL: сказано, что всё приходит черновиком", /Всё приходит черновиком\. В главу текст берёшь ты, записываешь тоже ты\./.test(await txt(page, "[data-ra]")));
  const order = await page.evaluate(() => { const y = (s) => document.querySelector(s).getBoundingClientRect().top; return y("[data-re-ch-body]") < y("[data-ra]") && y("[data-ra]") < y("[data-re-preview-btn]"); });
  ok("PANEL: блок стоит между текстом и «Как увидит сотрудник»", order);
  await page.fill("[data-re-ch-body]", "Короткий текст.");
  ok("PANEL: мало текста — править пока нечего", await page.evaluate(() => document.querySelector("[data-ra-btn='improve']").disabled));
  await page.fill("[data-re-ch-body]", LINES);
  ok("PANEL: с текстом кнопки правки открыты и есть подсказка про выделение", (await page.evaluate(() => !document.querySelector("[data-ra-btn='improve']").disabled && !document.querySelector("[data-ra-btn='shorten']").disabled)) && /Выдели несколько строк/.test(await txt(page, "[data-ra]")));
  await page.locator("[data-ra]").scrollIntoViewIfNeeded();
  await shot(page, "panel");
  same("PANEL: пока ничего не нажали, ассистенту ничего не ушло", await sent(page), []);
  same("PANEL: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── TOPIC ──────────────────────────────────────────────────────────────────────────────────────────────
if (on("TOPIC")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await newChapter(page);
  await tap(page, "[data-ra-btn='topic']");
  ok("TOPIC: без темы «Написать главу» не нажимается", await page.evaluate(() => document.querySelector("[data-ra-go='topic']").disabled));
  ok("TOPIC: честная пометка (с v169 — про поиск в интернете): проверь главу и добавь то, как принято у вас", /Ассистент поищет факты в интернете и покажет источники\..*Проверь главу и добавь то, как принято у вас\./.test(await txt(page, "[data-ra-warn]")));
  await tap(page, "[data-ra-cancel]");
  ok("TOPIC: «Отмена» закрывает форму", !(await has(page, "[data-ra-form]")));
  await page.fill("[data-re-ch-title]", "Раф и авторские напитки");
  await tap(page, "[data-ra-btn='topic']");
  ok("TOPIC: тема подставлена из названия главы", (await val(page, "[data-ra-topic]")) === "Раф и авторские напитки");
  await page.fill("[data-ra-notes]", "Раф готовим на сливках 10%\nСироп добавляем до взбивания\nПодаём в бокале айриш");
  await blur(page);
  await page.locator("[data-ra]").scrollIntoViewIfNeeded();
  await shot(page, "topic-form");
  await page.locator("[data-ra-go='topic']").click();
  await page.waitForTimeout(150);
  ok("TOPIC: пока ассистент пишет, кнопка говорит об этом (с v169 — «Ищу и пишу…») и остальные закрыты", /Ищу и пишу/.test(await txt(page, "[data-ra-go='topic']")) && (await page.evaluate(() => document.querySelector("[data-ra-btn='doc']").disabled)));
  await result(page);
  const s1 = await sent(page);
  same("TOPIC: ассистенту ушли режим, тема и заметки", s1.map((b) => [b.mode, b.title, b.text, b.pdfBase64, b.token]), [["ref_chapter", "Раф и авторские напитки", "Раф готовим на сливках 10%\nСироп добавляем до взбивания\nПодаём в бокале айриш", "", "demo-u-roman"]]);
  const pv = await page.evaluate(() => { const p = document.querySelector("[data-ra-preview]"); return { t: p.innerText.replace(/\s+/g, " "), raw: /\*\*|\[img:/.test(p.innerText), svg: p.querySelectorAll("svg").length }; });
  ok("TOPIC: ответ показан как глава: без значков разметки, с пометкой «важно»", /Главное 1\. Раф готовим на сливках 10% 2\. Сироп/.test(pv.t) && !pv.raw && pv.svg >= 1, pv);
  ok("TOPIC: над ответом название, под ним «Это черновик. Проверь факты»; кнопка «Взять в главу»", (await txt(page, "[data-ra-title]")) === "Раф и авторские напитки" && /Это черновик\. Проверь факты перед записью\./.test(await txt(page, "[data-ra-result]")) && (await txt(page, "[data-ra-take='replace']")) === "Взять в главу" && !(await has(page, "[data-ra-take='append']")));
  await page.locator("[data-ra-result]").scrollIntoViewIfNeeded();
  await shot(page, "topic-result");
  ok("TOPIC: пока не взял, текст главы пуст", (await val(page, "[data-re-ch-body]")) === "");
  await tap(page, "[data-ra-take='replace']");
  const b1 = await val(page, "[data-re-ch-body]");
  ok("TOPIC: взял — текст в главе, блок закрылся", /^\*\*Главное\*\*\n1\. Раф готовим на сливках 10%\n2\. Сироп добавляем до взбивания\n3\. Подаём в бокале айриш\n/.test(b1) && !(await has(page, "[data-ra-result]")), b1);
  ok("TOPIC: возвращать нечего (глава была пустой) — «Вернуть прежний текст» только с названием", (await val(page, "[data-re-ch-title]")) === "Раф и авторские напитки");
  await blur(page);
  await tap(page, "[data-re-save]");
  await page.waitForSelector("[data-re-screen='sec']");
  ok("TOPIC: главу записал владелец обычной кнопкой: она в разделе", /Раф и авторские напитки своя/.test(await txt(page)));
  await switchTo(page, errs, "anna");
  await nav(page, "reference", "[data-ref-card]");
  await tap(page, "[data-ref-card='coffee']");
  await page.getByText("Раф и авторские напитки").first().click(); await page.waitForTimeout(500);
  ok("TOPIC: сотрудник читает главу, собранную ассистентом и записанную владельцем", /Раф готовим на сливках 10%/.test(await txt(page)) && !/\*\*/.test(await txt(page)), (await txt(page)).slice(0, 200));
  same("TOPIC: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── DOC ────────────────────────────────────────────────────────────────────────────────────────────────
if (on("DOC")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await newChapter(page, "serving");
  await tap(page, "[data-ra-btn='doc']");
  ok("DOC: без текста и PDF «Собрать главу» не нажимается; есть совет про большой документ (с v169 — «Главы из документа»)", (await page.evaluate(() => document.querySelector("[data-ra-go='doc']").disabled)) && /Большой документ на несколько глав раскладывается в разделе/.test(await txt(page, "[data-ra-form]")) && (await has(page, "[data-ra-pdf] input[type=file]")));
  const MAT = "Стандарт встречи гостя.\nВстречаем гостя в первые десять секунд.\nПровожаем к столу, отодвигаем стул.\nПодаём меню открытым.";
  await page.fill("[data-ra-material]", MAT);
  await blur(page);
  await tap(page, "[data-ra-go='doc']");
  await result(page);
  ok("DOC: в пустую главу — «Взять в главу»; название предложено ассистентом", (await txt(page, "[data-ra-take='replace']")) === "Взять в главу" && (await txt(page, "[data-ra-title]")) === "Стандарт встречи гостя");
  await tap(page, "[data-ra-take='replace']");
  ok("DOC: названия не было — взято название ассистента вместе с текстом", (await val(page, "[data-re-ch-title]")) === "Стандарт встречи гостя" && /1\. Стандарт встречи гостя\.\n2\. Встречаем гостя/.test(await val(page, "[data-re-ch-body]")), await val(page, "[data-re-ch-title]"));
  // теперь текст есть: заменить или добавить в конец; своё название не затирается
  await page.fill("[data-re-ch-title]", "Встреча гостя: наш стандарт");
  const before = await val(page, "[data-re-ch-body]");
  await tap(page, "[data-ra-btn='doc']");
  ok("DOC: после взятия форма пустая: прежний материал не подставлен", (await val(page, "[data-ra-material]")) === "");
  await page.fill("[data-ra-material]", "Прощаемся у выхода и приглашаем вернуться.\nПодаём верхнюю одежду, если есть гардероб.");
  await blur(page);
  await tap(page, "[data-ra-go='doc']");
  await result(page);
  same("DOC: в главе уже есть текст — «Заменить текст» и «Добавить в конец»", await page.evaluate(() => [...document.querySelectorAll("[data-ra-take]")].map((b) => b.innerText)), ["Заменить текст", "Добавить в конец"]);
  ok("DOC: ассистенту ушла тема из названия главы", (await sent(page))[1].title === "Встреча гостя: наш стандарт" && (await sent(page))[1].mode === "ref_chapter");
  await page.locator("[data-ra-result]").scrollIntoViewIfNeeded();
  await shot(page, "doc-result");
  await tap(page, "[data-ra-take='append']");
  const after = await val(page, "[data-re-ch-body]");
  ok("DOC: «Добавить в конец»: прежний текст цел, новый за ним через пустую строку", after.startsWith(before.replace(/\s+$/, "") + "\n\n**Главное**\n1. Прощаемся у выхода") && (await val(page, "[data-re-ch-title]")) === "Встреча гостя: наш стандарт", after);
  ok("DOC: после правки ассистента — «Вернуть прежний текст»", (await has(page, "[data-ra-undo]")) && /Ассистент поменял текст главы\./.test(await txt(page, "[data-ra-undo]")));
  await tap(page, "[data-ra-undo-btn]");
  ok("DOC: вернул — текст прежний, строка возврата убрана", (await val(page, "[data-re-ch-body]")) === before && !(await has(page, "[data-ra-undo]")));
  // заменить
  await tap(page, "[data-ra-btn='doc']");
  await page.fill("[data-ra-material]", "Прощаемся у выхода и приглашаем вернуться.\nПодаём верхнюю одежду, если есть гардероб.");
  await blur(page);
  await tap(page, "[data-ra-go='doc']");
  await result(page);
  await tap(page, "[data-ra-take='replace']");
  ok("DOC: «Заменить текст»: в главе только новый текст, название владельца осталось", /^\*\*Главное\*\*\n1\. Прощаемся у выхода/.test(await val(page, "[data-re-ch-body]")) && !/Встречаем гостя/.test(await val(page, "[data-re-ch-body]")) && (await val(page, "[data-re-ch-title]")) === "Встреча гостя: наш стандарт");
  same("DOC: на сервер справочника ассистент сам ничего не записал", await rows(page), []);
  same("DOC: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── FIX ────────────────────────────────────────────────────────────────────────────────────────────────
if (on("FIX")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await newChapter(page);
  await page.fill("[data-re-ch-title]", "Раф");
  await page.fill("[data-re-ch-body]", LINES);
  await setSel(page, null, null);
  await blur(page);
  await page.locator("[data-ra-btn='improve']").click();
  await page.waitForTimeout(150);
  ok("FIX: пока ассистент работает — «Улучшаю текст…»", /Улучшаю текст…/.test(await txt(page, "[data-ra-busy]")), await txt(page, "[data-ra]"));
  await result(page);
  ok("FIX: вся глава: «Было … стало …», кнопка «Заменить текст», «Добавить в конец» нет", /^Было 224 знака, стало \d+ знак/.test(await txt(page, "[data-ra-stat]")) && (await txt(page, "[data-ra-take='replace']")) === "Заменить текст" && !(await has(page, "[data-ra-take='append']")), await txt(page, "[data-ra-stat]"));
  same("FIX: ассистенту ушёл текст главы целиком", (await sent(page)).map((b) => [b.mode, b.text]), [["ref_improve", LINES]]);
  await page.locator("[data-ra-result]").scrollIntoViewIfNeeded();
  await shot(page, "fix-improve");
  await tap(page, "[data-ra-take='replace']");
  const b1 = await val(page, "[data-re-ch-body]");
  ok("FIX: текст заменён, картинка осталась на своём месте", b1 === "• Раф готовим на сливках десять процентов, это важно для вкуса.\n[img:espresso_cup]\n• Сироп добавляем до взбивания, иначе он не смешается.\n• Подаём в бокале айриш на блюдце с ложкой.\n• Ещё одно правило про температуру подачи напитка.", b1);
  await tap(page, "[data-ra-undo-btn]");
  ok("FIX: «Вернуть прежний текст» возвращает главу как была", (await val(page, "[data-re-ch-body]")) === LINES);
  // фрагмент
  await setSel(page, "добавляем до", "блюдце с");
  await page.locator("[data-ra-btn='shorten']").click();
  await page.waitForTimeout(150);
  ok("FIX: выделены две строки — ассистент работает только с ними", /Сокращаю… Только выделенное\./.test(await txt(page, "[data-ra-busy]")), await txt(page, "[data-ra]"));
  await result(page);
  const frag = "Сироп добавляем до взбивания, иначе он не смешается.\nПодаём в бокале айриш на блюдце с ложкой.";
  ok("FIX: ассистенту ушли целые строки выделения, а не обрывки", (await sent(page))[1].mode === "ref_shorten" && (await sent(page))[1].text === frag, (await sent(page))[1]);
  ok("FIX: «Выделенный фрагмент. Было 94 знака…», кнопка «Заменить фрагмент»", /^Выделенный фрагмент\. Было 94 знака, стало \d+ знак/.test(await txt(page, "[data-ra-stat]")) && (await txt(page, "[data-ra-take='replace']")) === "Заменить фрагмент", await txt(page, "[data-ra-stat]"));
  ok("FIX: у ответа по фрагменту есть «Нужна вся глава»", (await txt(page, "[data-ra-whole]")) === "Нужна вся глава");
  await tap(page, "[data-ra-take='replace']");
  ok("FIX: заменён только фрагмент, остальной текст и картинка не тронуты", (await val(page, "[data-re-ch-body]")) === "Раф готовим на сливках десять процентов, это важно для вкуса.\n[img:espresso_cup]\nСироп добавляем до взбивания, иначе он не смешается.\nЕщё одно правило про температуру подачи напитка.", await val(page, "[data-re-ch-body]"));
  // текст поменяли, пока ассистент думал: фрагмент ищется по содержимому
  await page.fill("[data-re-ch-body]", LINES);
  await setSel(page, "добавляем до", "блюдце с");
  await tap(page, "[data-ra-btn='improve']");
  await result(page);
  await page.fill("[data-re-ch-body]", "Новое вступление.\n" + LINES);
  await tap(page, "[data-ra-take='replace']");
  ok("FIX: текст сдвинулся, пока ассистент думал, — фрагмент найден и заменён на новом месте", (await val(page, "[data-re-ch-body]")) === "Новое вступление.\n" + LINES.replace(frag, "• Сироп добавляем до взбивания, иначе он не смешается.\n• Подаём в бокале айриш на блюдце с ложкой."), await val(page, "[data-re-ch-body]"));
  await page.fill("[data-re-ch-body]", LINES);
  await setSel(page, "добавляем до", "блюдце с");
  await tap(page, "[data-ra-btn='improve']");
  await result(page);
  await page.fill("[data-re-ch-body]", LINES.replace("Сироп добавляем", "Сироп всегда добавляем"));
  await tap(page, "[data-ra-take='replace']");
  ok("FIX: фрагмент переписали руками — ассистент не затирает правку, а говорит об этом", /Текст главы изменился, фрагмент не найден/.test(await txt(page, "[data-ra-err]")) && /Сироп всегда добавляем/.test(await val(page, "[data-re-ch-body]")));
  // выделение осталось, а нужна вся глава: одной кнопкой
  await page.fill("[data-re-ch-body]", LINES);
  await setSel(page, "добавляем до", "блюдце с");
  await tap(page, "[data-ra-btn='improve']");
  await result(page);
  const n1 = (await sent(page)).length;
  await tap(page, "[data-ra-whole]");
  await page.waitForFunction((n) => (window.__aiSent || []).length > n, n1, { timeout: 15000 });
  await result(page);
  const last = (await sent(page)).slice(-1)[0];
  ok("FIX: «Нужна вся глава» — тот же запрос для всего текста, кнопка стала «Заменить текст»", last.mode === "ref_improve" && last.text === LINES && (await txt(page, "[data-ra-take='replace']")) === "Заменить текст" && !(await has(page, "[data-ra-whole]")), last);
  // пока ответ на экране, в текст вставили фото: при замене всего текста оно не пропадает
  await page.fill("[data-re-ch-body]", LINES + "\n[photo:rp:new1|Сливки]");
  await tap(page, "[data-ra-take='replace']");
  const b9 = await val(page, "[data-re-ch-body]");
  ok("FIX: фото вставили, пока ответ был на экране, — после «Заменить текст» оно в конце, об этом сказано", /^• Раф готовим/.test(b9) && /\n\[img:espresso_cup\]\n/.test(b9) && /\n\n\[photo:rp:new1\|Сливки\]$/.test(b9)
    && /Картинка прежнего текста перенесена в конец\. Поставь её на место или убери\./.test(await txt(page, "[data-ra-kept]")), b9);
  await tap(page, "[data-ra-undo-btn]");
  ok("FIX: «Вернуть прежний текст» возвращает и текст, и фото на своё место", (await val(page, "[data-re-ch-body]")) === LINES + "\n[photo:rp:new1|Сливки]" && !(await has(page, "[data-ra-undo]")));
  // «Начать заново» у восстановленного черновика стирает его: ассистенту возвращать уже нечего
  await page.fill("[data-re-ch-body]", LINES);
  await page.waitForTimeout(900);
  await tap(page, "[data-lens='back']");
  await tap(page, "[data-re-new-ch]");
  await setSel(page, null, null);
  await blur(page);
  await tap(page, "[data-ra-btn='improve']");
  await result(page);
  await tap(page, "[data-ra-take='replace']");
  const hadUndo = await has(page, "[data-ra-undo]");
  await tap(page, "[data-re-draft-drop]");
  ok("FIX: «Начать заново» — глава пустая, строки «Вернуть прежний текст» больше нет", hadUndo && (await val(page, "[data-re-ch-body]")) === "" && !(await has(page, "[data-ra-undo]")) && !(await has(page, "[data-ra-result]")), [hadUndo, await val(page, "[data-re-ch-body]")]);
  same("FIX: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── SAFE ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("SAFE")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  const BODY = "Раф готовим на сливках десять процентов, это важно для вкуса.\n[photo:rp:e2e1|Бокал айриш]\nСироп добавляем до взбивания, иначе он не смешается.";
  await seedBook(page, [R("rs-e2e", "sec", { title: "Стандарты заведения" }), R("rc-e2e", "ch", { parent: "rs-e2e", title: "Раф", body: BODY })]);
  await page.evaluate(() => { window.__demo.srv.rpc("lesson_photo_set", { p_token: "demo-u-roman", p_lesson: "rp:e2e1", p_scope: "", p_full: "QUJD".repeat(60), p_thumb: "REVG".repeat(10), p_w: 900, p_h: 600 }); window.__demo.save(); });
  await page.reload({ waitUntil: "load" }); await ready(page, errs);
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='rs-e2e']");
  await tap(page, "[data-re-ch='rc-e2e']");
  await spy(page);
  await page.evaluate(() => sessionStorage.setItem("__e2e_ai", "drop"));
  await setSel(page, null, null);
  await blur(page);
  await tap(page, "[data-ra-btn='improve']");
  await result(page);
  ok("SAFE: «модель» потеряла фото — редактор говорит об этом", /Ассистент пропустил одну картинку: она добавлена в конец текста\. Поставь её на место\./.test(await txt(page, "[data-ra-lost]")), await txt(page, "[data-ra-result]"));
  await page.locator("[data-ra-result]").scrollIntoViewIfNeeded();
  await shot(page, "safe-lost");
  await tap(page, "[data-ra-take='replace']");
  const b = await val(page, "[data-re-ch-body]");
  ok("SAFE: строка фото возвращена в конец текста, выдуманная «моделью» картинка убрана", /\n\n\[photo:rp:e2e1\|Бокал айриш\]$/.test(b) && !/made_up/.test(b), b);
  await blur(page);
  await tap(page, "[data-re-save]");
  await page.waitForSelector("[data-re-screen='sec']");
  await page.waitForTimeout(300);
  same("SAFE: главу записали — фото на сервере осталось", await photosOnServer(page), ["rp:e2e1|"]);
  // новая глава вместо прежнего текста: фото прежнего текста переносится в конец и после записи остаётся на сервере
  await tap(page, "[data-re-ch='rc-e2e']");
  await page.evaluate(() => sessionStorage.removeItem("__e2e_ai"));
  await tap(page, "[data-ra-btn='doc']");
  await page.fill("[data-ra-material]", "Раф подаём в бокале айриш на блюдце.\nСливки берём десять процентов.\nСироп добавляем до взбивания.");
  await blur(page);
  await tap(page, "[data-ra-go='doc']");
  await result(page);
  await tap(page, "[data-ra-take='replace']");
  const b2 = await val(page, "[data-re-ch-body]");
  ok("SAFE: новая глава вместо прежнего текста — фото прежнего текста перенесено в конец, об этом сказано", /^\*\*Главное\*\*\n1\. Раф подаём в бокале айриш на блюдце/.test(b2) && /\n\n\[photo:rp:e2e1\|Бокал айриш\]$/.test(b2)
    && /Картинка прежнего текста перенесена в конец\. Поставь её на место или убери\./.test(await txt(page, "[data-ra-kept]")), b2);
  await page.locator("[data-ra-undo]").scrollIntoViewIfNeeded();
  await shot(page, "safe-kept");
  await blur(page);
  await tap(page, "[data-re-save]");
  await page.waitForSelector("[data-re-screen='sec']");
  await page.waitForTimeout(300);
  same("SAFE: и эту главу записали — фото на сервере осталось", await photosOnServer(page), ["rp:e2e1|"]);
  // отказ ассистента
  await tap(page, "[data-re-ch='rc-e2e']");
  await page.evaluate(() => sessionStorage.setItem("__e2e_ai", "fail"));
  const keep = await val(page, "[data-re-ch-body]");
  await blur(page);
  await tap(page, "[data-ra-btn='shorten']");
  await page.waitForSelector("[data-ra-err]", { timeout: 15000 });
  ok("SAFE: ассистент не ответил — причина словами, текст главы не тронут, кнопки снова открыты", /Ассистент не ответил\. Попробуй ещё раз\./.test(await txt(page, "[data-ra-err]")) && (await val(page, "[data-re-ch-body]")) === keep && !(await page.evaluate(() => document.querySelector("[data-ra-btn='improve']").disabled)));
  await page.evaluate(() => sessionStorage.removeItem("__e2e_ai"));
  // длинный текст без выделения
  const n0 = (await sent(page)).length;
  await page.fill("[data-re-ch-body]", ("Очень длинная строка главы справочника про подачу напитков гостю. ").repeat(150));
  await setSel(page, null, null);
  await blur(page);
  await tap(page, "[data-ra-btn='improve']");
  await page.waitForTimeout(400);
  ok("SAFE: длинная глава без выделения — просьба выделить часть, запрос не уходит", /Текст длинный для одного раза\. Выдели часть, и ассистент поправит её\./.test(await txt(page, "[data-ra-err]")) && (await sent(page)).length === n0, await txt(page, "[data-ra]"));
  same("SAFE: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── LOOK ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("LOOK")) {
  for (const [name, o] of [["светлая тема", { light: true }], ["360 px", { width: 360, height: 760 }], ["1280 px", { width: 1280, height: 860 }]]) {
    const { ctx, page, errs } = await open({ who: "roman", ...o });
    await newChapter(page);
    await page.fill("[data-re-ch-title]", "Раф и авторские напитки на альтернативном молоке");
    await page.fill("[data-re-ch-body]", LINES);
    await blur(page);
    await tap(page, "[data-ra-btn='doc']");
    let lk = await look(page);
    ok("LOOK " + name + ": форма «Глава из материала» не вылезает, шрифт не мелкий", lk.scroll && !lk.small && !lk.wide, lk);
    await page.fill("[data-ra-material]", "Стандарт подачи рафа.\nГотовим на сливках десять процентов.\nСироп добавляем до взбивания.");
    await blur(page);
    await tap(page, "[data-ra-go='doc']");
    await result(page);
    lk = await look(page);
    ok("LOOK " + name + ": ответ ассистента с тремя кнопками не вылезает, шрифт не мелкий", lk.scroll && !lk.small && !lk.wide, lk);
    const box = await page.evaluate(() => { const p = document.querySelector("[data-ra-preview]").getBoundingClientRect(), a = document.querySelector("[data-ra]").getBoundingClientRect(); return { in: p.left >= a.left && p.right <= a.right + 1, h: Math.round(p.height) }; });
    ok("LOOK " + name + ": предпросмотр ответа внутри блока и не выше 300 px", box.in && box.h <= 301, box);
    await page.locator("[data-ra-result]").scrollIntoViewIfNeeded();
    await shot(page, "look-" + (o.light ? "light" : o.width));
    if (o.light) {
      const ink = await page.evaluate(() => { const c = getComputedStyle(document.querySelector("[data-ra-preview] div")).color.match(/\d+/g).map(Number); return c[0] + c[1] + c[2]; });
      ok("LOOK светлая тема: текст ответа тёмный", ink < 300, ink);
    }
    await tap(page, "[data-ra-take='replace']");
    lk = await look(page);
    ok("LOOK " + name + ": «Вернуть прежний текст» с пометкой о картинке не вылезает, шрифт не мелкий", (await has(page, "[data-ra-kept]")) && lk.scroll && !lk.small && !lk.wide, lk);
    await page.locator("[data-ra-undo]").scrollIntoViewIfNeeded();
    await shot(page, "look-undo-" + (o.light ? "light" : o.width));
    same("LOOK " + name + ": ошибок на странице нет", errs, []);
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log("\nитог: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
