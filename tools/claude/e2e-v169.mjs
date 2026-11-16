// e2e v169 (Доп. 494): ассистент редактора справочника раскладывает большой документ на главы и ходит в интернет.
// В браузере, на демо целиком (tools/claude/demo-app/build.mjs). Модели и интернета в демо нет: «ассистент» собирает
// ответ из присланного текста, проверка запроса и разбор ответа — те же, что на сервере (lib/ref-ai.js).
// sessionStorage.__e2e_ai: "fail" — ассистент не ответил; "noweb" — поиск в интернете не ответил; "failpart:слово" —
// не пишется глава, в названии которой есть это слово.
//   SPLIT — «Главы из документа» в разделе: документ → план глав (правка названий, галочки, повтор) → главы по одной,
//           сразу в раздел скрытыми, в порядке документа; сотрудник их не видит, пока владелец не покажет;
//   FAIL  — одна глава не написалась и дописана со второй попытки (встаёт на своё место); две неудачи подряд — стоп;
//   STOP  — «Остановить»; работа не прерывается, пока владелец открыл готовую главу; другой раздел ждёт; PDF;
//   WEB   — «Глава по теме» с поиском: источники; поиск не ответил — глава без него и причина словами;
//   CHECK — «Проверить факты»: замечания с галочками, источники, «Поправить отмеченное», фрагмент, отказ поиска;
//   LOOK  — светлая тема и 360 px: блоки не вылезают, шрифт не мельче 10.5 px.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_ONLY="SPLIT WEB"] node e2e-v169.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5669, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v169";
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
const parts = async (page) => (await sent(page)).filter((x) => x.mode === "ref_part");
const val = (page, sel) => page.inputValue(sel);
const flag = (page, v) => page.evaluate((x) => { if (x) sessionStorage.setItem("__e2e_ai", x); else sessionStorage.removeItem("__e2e_ai"); }, v);
const result = async (page) => { await page.waitForSelector("[data-ra-result]", { timeout: 15000 }); await page.waitForTimeout(250); };
const setSel = (page, from, to) => page.evaluate(([a, b]) => { const t = document.querySelector("[data-re-ch-body]"); const v = t.value; const s = a == null ? 0 : v.indexOf(a), e = b == null ? s : v.indexOf(b) + b.length; t.focus(); t.setSelectionRange(s, e); }, [from, to]);
// куда редактор открыл ссылку: браузер Telegram (в демо) или новая вкладка
const spyOpen = (page) => page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; }; const tg = window.Telegram && window.Telegram.WebApp; if (tg) tg.openLink = (u) => { window.__opened.push(String(u)); }; });
async function newChapter(page, sec = "coffee") {
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='" + sec + "']");
  await tap(page, "[data-re-new-ch]");
  await page.waitForSelector("[data-ra]");
  await spy(page);
}

// ── «Главы из документа»: свой раздел с одной главой и документ из четырёх тем ──
const SEC = "rs-e2e";
const DOC = [
  "Встреча гостя\nВстречаем гостя у входа за десять секунд.\nЗдороваемся и называем заведение.\nУточняем, ждут ли гостя.",
  "Подача вина\nБутылку показываем гостю этикеткой.\nПробу наливаем тому, кто заказал.\nБелое подаём при 8–10 градусах.",
  "Расчёт\nСчёт приносим в течение трёх минут.\nСдачу отдаём до копейки.",
  "Прощание с гостем\nПровожаем до двери.\nБлагодарим и приглашаем снова.",
].join("\n\n");
const DOC2 = [
  "Сервировка стола\nТарелку ставим в двух сантиметрах от края стола.\nПриборы кладём по порядку подачи блюд.\nБокал для воды ставим над ножом.",
  "Уборка стола\nПосуду убираем справа от гостя.\nКрошки сметаем после горячего блюда.\nПепельницу меняем, накрыв чистой.",
].join("\n\n");
async function openSec(page, sec = SEC) {
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='" + sec + "']");
  await page.waitForSelector("[data-rs-open], [data-rs], [data-rs-away]");
  await spy(page);
}
// владелец, свой раздел с одной главой, открыт экран раздела
async function start(o = {}) {
  const x = await open({ who: "roman", ...o });
  await seedBook(x.page, [R(SEC, "sec", { title: "Стандарты e2e" }), R("rc-old", "ch", { parent: SEC, title: "Встреча гостя", body: "Старый текст главы про встречу гостя у входа: здороваемся и провожаем к столу." })]);
  await openSec(x.page);
  return x;
}
async function toPlan(page, doc = DOC) {
  await tap(page, "[data-rs-open]");
  await page.fill("[data-rs-text]", doc);
  await blur(page);
  await page.locator("[data-rs-plan]").click();
  await page.waitForSelector("[data-rs='plan']", { timeout: 15000 });
  await page.waitForTimeout(200);
}
const done = (page, how = "") => page.waitForSelector(how ? "[data-rs-done='" + how + "']" : "[data-rs='done']", { timeout: 30000 }).then(() => page.waitForTimeout(250));
const items = (page) => attrs(page, "data-rs-item");
// главы раздела на сервере по местам: [название, скрыта, место]
const secRows = async (page) => (await rows(page)).filter((x) => x[1] === "ch" && x[2] === SEC).sort((p, q) => p[5] - q[5]).map((x) => [x[3], x[4], x[5]]);
const chList = (page) => page.evaluate(() => [...document.querySelectorAll("[data-re-ch]")].map((el) => el.innerText.replace(/\s+/g, " ").trim()));
const seenBy = (page) => page.evaluate(() => [...document.querySelectorAll("[data-ref-chapter]")].map((el) => el.getAttribute("aria-label")));

// ── SPLIT ──────────────────────────────────────────────────────────────────────────────────────────────
if (on("SPLIT")) {
  const { ctx, page, errs } = await start();
  ok("SPLIT: в разделе под «Новая глава» есть «Главы из документа» с подсказкой", /Главы из документа/.test(await txt(page, "[data-rs-open]")) && /Большой регламент ассистент разложит на несколько глав\./.test(await txt(page, "[data-re-screen='sec']"))
    && (await page.evaluate(() => { const a = document.querySelector("[data-re-new-ch]"), b = document.querySelector("[data-rs-open]"); return a.getBoundingClientRect().bottom <= b.getBoundingClientRect().top; })));
  await tap(page, "[data-rs-open]");
  ok("SPLIT: форма: поле документа, PDF; без текста «Предложить главы» закрыта", (await has(page, "[data-rs-text]")) && (await has(page, "[data-rs-pdf] input[type=file]")) && (await page.evaluate(() => document.querySelector("[data-rs-plan]").disabled))
    && /Текст до 60 000 знаков, PDF до 3 МБ\./.test(await txt(page, "[data-rs-size]")) && /Список можно поправить до того, как он начнёт писать\./.test(await txt(page, "[data-rs-form]")));
  await page.fill("[data-rs-text]", "Короткая заметка про встречу гостя.");
  await blur(page);
  await tap(page, "[data-rs-plan]");
  ok("SPLIT: текста мало — отказ словами, ассистент не тратится", /Текста мало для нескольких глав\. Одну главу ассистент соберёт в редакторе главы\./.test(await txt(page, "[data-rs-err]")) && (await sent(page)).length === 0, await txt(page, "[data-rs]"));
  await page.fill("[data-rs-text]", DOC);
  await blur(page);
  await page.locator("[data-rs-plan]").click();
  ok("SPLIT: пока ассистент читает, кнопка говорит «Читаю документ…»", /Читаю документ/.test(await txt(page, "[data-rs-plan]")) && !(await has(page, "[data-rs-err]")));
  await page.waitForSelector("[data-rs='plan']", { timeout: 15000 });
  const plan = await page.evaluate(() => [...document.querySelectorAll("[data-rs-row]")].map((el) => [el.querySelector("[data-rs-title]").value, el.getAttribute("data-rs-on"), (el.querySelector("[data-rs-about]") || {}).textContent || "", /такая глава уже есть в разделе/.test(el.textContent)]));
  same("SPLIT: план — четыре главы по порядку документа; та, что в разделе уже есть, без галочки и с пометкой", plan, [["Встреча гостя", "0", "Встречаем гостя у входа за десять секунд.", true], ["Подача вина", "1", "Бутылку показываем гостю этикеткой.", false],
    ["Расчёт", "1", "Счёт приносим в течение трёх минут.", false], ["Прощание с гостем", "1", "Провожаем до двери.", false]]);
  same("SPLIT: ассистенту ушёл документ целиком, режим ref_plan", (await sent(page)).map((x) => [x.mode, x.text === DOC, x.pdfBase64]), [["ref_plan", true, ""]]);
  ok("SPLIT: кнопка считает отмеченные главы; сказано, что главы лягут скрытыми", /Написать главы \(3\)/.test(await txt(page, "[data-rs-run]")) && /сразу ложатся в раздел скрытыми: команда их не увидит, пока ты не проверишь и не покажешь\./.test(await txt(page, "[data-rs]")));
  // владелец правит план: переименовал третью главу, снял галочку с четвёртой
  await page.fill("[data-rs-row='2'] [data-rs-title]", "Расчёт гостя");
  await page.locator("[data-rs-row='3'] [data-rs-tick]").click();
  await blur(page);
  ok("SPLIT: сняли галочку — глав стало две", /Написать главы \(2\)/.test(await txt(page, "[data-rs-run]")) && (await page.getAttribute("[data-rs-row='3']", "data-rs-on")) === "0");
  await page.locator("[data-rs]").scrollIntoViewIfNeeded();
  await shot(page, "split-plan");
  await page.locator("[data-rs-run]").click();
  await page.waitForSelector("[data-rs='writing']");
  ok("SPLIT: идёт работа: «Пишу главу 1 из 2…», есть «Остановить»", /Пишу главу 1 из 2/.test(await txt(page, "[data-rs-progress]")) && (await has(page, "[data-rs-stop]")), await txt(page, "[data-rs]"));
  await done(page);
  ok("SPLIT: готово — в разделе две новые главы, сказано, что они скрыты и что с ними делать", /Готово: в разделе 2 новые главы\./.test(await txt(page, "[data-rs-done]")) && (await items(page)).join() === "done,done"
    && /Новые главы скрыты: команда их не видит\. Открой каждую, проверь и нажми в ней «Показать главу»\./.test(await txt(page, "[data-rs]")), await txt(page, "[data-rs]"));
  same("SPLIT: на сервере главы лежат в разделе скрытыми, в порядке документа, после прежней", await secRows(page), [["Встреча гостя", false, 10], ["Подача вина", true, 20], ["Расчёт гостя", true, 30]]);
  same("SPLIT: ассистенту — по обращению на главу: название, «что войдёт», остальные главы, документ", (await parts(page)).map((x) => [x.title, x.about, x.others, x.text === DOC]),
    [["Подача вина", "Бутылку показываем гостю этикеткой.", ["Расчёт гостя"], true], ["Расчёт гостя", "Счёт приносим в течение трёх минут.", ["Подача вина"], true]]);
  const list = await chList(page);
  ok("SPLIT: в списке глав раздела новые главы стоят последними, с пометками «своя» и «скрыта»", list.length === 3 && /Подача вина.*своя.*скрыта/.test(list[1]) && /Расчёт гостя.*своя.*скрыта/.test(list[2]), list);
  await page.locator("[data-rs]").scrollIntoViewIfNeeded();
  await shot(page, "split-done");
  await tap(page, "[data-rs-close]");
  ok("SPLIT: «Готово» закрывает блок, кнопка снова на месте", (await has(page, "[data-rs-open]")) && !(await has(page, "[data-rs]")));
  // готовая глава — обычная глава редактора
  await page.locator("[data-re-ch]").nth(2).click();
  await page.waitForSelector("[data-re-screen='ch']");
  ok("SPLIT: готовая глава открывается в редакторе: название, текст в разметке справочника, пометка «скрыта»", (await val(page, "[data-re-ch-title]")) === "Расчёт гостя"
    && /^\*\*Расчёт гостя\*\*\n1\. Счёт приносим в течение трёх минут\n2\. Сдачу отдаём до копейки\n/.test(await val(page, "[data-re-ch-body]")) && /Глава скрыта: команда её не видит\./.test(await txt(page)), await val(page, "[data-re-ch-body]"));
  // сотрудник скрытых глав не видит; владелец показал одну — видит её
  await switchTo(page, errs, "anna");
  await nav(page, "reference", "[data-ref-card]");
  await tap(page, "[data-ref-card='" + SEC + "']");
  same("SPLIT: сотрудник новых глав не видит: они скрыты", await seenBy(page), ["Встреча гостя"]);
  await switchTo(page, errs, "roman");
  await openSec(page);
  await page.locator("[data-re-ch]").nth(1).click();
  await page.waitForSelector("[data-re-screen='ch']");
  ok("SPLIT: у скрытой главы сверху пометка и кнопка «Показать главу»", /Глава скрыта: команда её не видит\./.test(await txt(page, "[data-re-ch-hidden]")) && /Показать главу/.test(await txt(page, "[data-re-ch-show]")));
  await shot(page, "split-hidden");
  await tap(page, "[data-re-ch-show]");
  await page.waitForTimeout(500);
  ok("SPLIT: нажал — пометка ушла, сказано, что глава снова видна", !(await has(page, "[data-re-ch-hidden]")) && /Глава снова видна команде\./.test(await txt(page)), await txt(page));
  await switchTo(page, errs, "anna");
  await nav(page, "reference", "[data-ref-card]");
  await tap(page, "[data-ref-card='" + SEC + "']");
  same("SPLIT: владелец проверил главу и нажал «Показать главу» — сотрудник её видит", await seenBy(page), ["Встреча гостя", "Подача вина"]);
  same("SPLIT: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── FAIL ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("FAIL")) {
  let { ctx, page, errs } = await start();
  await flag(page, "failpart:вина");
  await toPlan(page);
  await page.locator("[data-rs-run]").click();
  await done(page);
  ok("FAIL: одна глава не написалась — остальные в разделе, причина словами, «Дописать остальные (1)»", /В разделе 2 новые главы из 3\./.test(await txt(page, "[data-rs-done]")) && (await items(page)).join() === "fail,done,done"
    && /Ассистент не ответил\. Попробуй ещё раз\./.test(await txt(page, "[data-rs-item-err]")) && /Дописать остальные \(1\)/.test(await txt(page, "[data-rs-more]")), [await txt(page, "[data-rs]"), await items(page)]);
  same("FAIL: в разделе пока две новые главы", (await secRows(page)).map((x) => x[0]), ["Встреча гостя", "Расчёт", "Прощание с гостем"]);
  await page.locator("[data-rs]").scrollIntoViewIfNeeded();
  await shot(page, "fail-one");
  await flag(page, "");
  await page.locator("[data-rs-more]").click();
  await done(page, "all");
  ok("FAIL: «Дописать остальные» пишет только неудачную главу", (await items(page)).join() === "done,done,done" && (await parts(page)).map((x) => x.title).join() === "Подача вина,Расчёт,Прощание с гостем,Подача вина", (await parts(page)).map((x) => x.title));
  same("FAIL: дописанная глава встала на своё место, как в документе", await secRows(page), [["Встреча гостя", false, 10], ["Подача вина", true, 20], ["Расчёт", true, 30], ["Прощание с гостем", true, 40]]);
  same("FAIL: ошибок на странице нет", errs, []);
  await ctx.close();
  // ассистент не отвечает совсем: после двух неудач подряд работа останавливается сама
  ({ ctx, page, errs } = await start());
  await toPlan(page);
  await flag(page, "fail");
  await page.locator("[data-rs-run]").click();
  await done(page);
  ok("FAIL: две неудачи подряд — работа остановилась сама, третья глава не начата, обращений два", /Пока ни одна глава не написана\. Ассистент не отвечает: остановился после двух неудач подряд\./.test(await txt(page, "[data-rs-done]"))
    && (await items(page)).join() === "fail,fail,none" && (await parts(page)).length === 2, [await txt(page, "[data-rs-done]"), await items(page), (await parts(page)).length]);
  ok("FAIL: в разделе ничего не прибавилось, а дописать можно", (await secRows(page)).length === 1 && /Дописать остальные \(3\)/.test(await txt(page, "[data-rs-more]")));
  await flag(page, "");
  await page.locator("[data-rs-more]").click();
  await done(page, "all");
  same("FAIL: ассистент ожил — все три главы в разделе, по порядку", (await secRows(page)).map((x) => x[0]), ["Встреча гостя", "Подача вина", "Расчёт", "Прощание с гостем"]);
  same("FAIL: ошибок на странице нет (второй заход)", errs, []);
  await ctx.close();
}

// ── STOP ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("STOP")) {
  const { ctx, page, errs } = await start();
  await toPlan(page);
  await page.locator("[data-rs-run]").click();
  await page.waitForSelector("[data-rs='writing']");
  await page.locator("[data-rs-stop]").click();
  ok("STOP: «Остановить» — текущую главу ассистент допишет, кнопка больше не жмётся", /Допишу её и остановлюсь\./.test(await txt(page, "[data-rs-progress]")) && (await page.evaluate(() => document.querySelector("[data-rs-stop]").disabled)), await txt(page, "[data-rs]"));
  await done(page);
  ok("STOP: одна глава в разделе, остальные не начаты, можно дописать", /В разделе 1 новая глава из 3\. Остановлено\./.test(await txt(page, "[data-rs-done]")) && (await items(page)).join() === "done,none,none"
    && /Дописать остальные \(2\)/.test(await txt(page, "[data-rs-more]")) && (await parts(page)).length === 1, [await txt(page, "[data-rs-done]"), await items(page)]);
  // дописываем; пока пишется, владелец открывает готовую главу — работа не прерывается
  await page.locator("[data-rs-more]").click();
  await page.waitForSelector("[data-rs='writing']");
  await page.locator("[data-re-ch]").nth(1).click();
  await page.waitForSelector("[data-re-screen='ch']");
  ok("STOP: пока ассистент пишет остальные, готовая глава открыта в редакторе", (await val(page, "[data-re-ch-title]")) === "Подача вина");
  await page.waitForTimeout(3200);
  await tap(page, "[data-lens='back']");
  await done(page);
  ok("STOP: вернулся в раздел — работа не прервалась, все главы написаны", /Готово: в разделе 3 новые главы\./.test(await txt(page, "[data-rs-done]")) && (await items(page)).join() === "done,done,done" && (await secRows(page)).length === 4, [await txt(page, "[data-rs-done]"), await secRows(page)]);
  await tap(page, "[data-rs-close]");
  // новый документ; пока он пишется, владелец уходит в другой раздел
  await toPlan(page, DOC2);
  await page.locator("[data-rs-run]").click();
  await page.waitForSelector("[data-rs='writing']");
  await page.locator("[data-lens='back']").first().click();
  await page.locator("[data-re-sec='coffee']").click();
  await page.waitForSelector("[data-rs-away], [data-rs-open]");
  ok("STOP: в другом разделе сказано, где ассистент занят, и начать здесь нельзя", /Ассистент сейчас раскладывает документ в разделе «Стандарты e2e»\. Когда закончит, можно будет и здесь\./.test(await txt(page, "[data-re-screen='sec']")) && !(await has(page, "[data-rs-open]")), await txt(page, "[data-re-screen='sec']"));
  await page.waitForSelector("[data-rs-open]", { timeout: 20000 });
  ok("STOP: работа закончилась — и здесь можно начать; главы легли в свой раздел", (await secRows(page)).map((x) => x[0]).slice(-2).join() === "Сервировка стола,Уборка стола" && (await rows(page)).filter((x) => x[1] === "ch" && x[2] === "coffee").length === 0, await secRows(page));
  // PDF вместо текста (назад к списку разделов и в свой раздел)
  await tap(page, "[data-lens='back']");
  await tap(page, "[data-re-sec='" + SEC + "']");
  ok("STOP: в своём разделе итог раскладки дождался владельца", /Готово: в разделе 2 новые главы\./.test(await txt(page, "[data-rs-done]")) && (await items(page)).join() === "done,done", await txt(page, "[data-re-screen='sec']"));
  await tap(page, "[data-rs-close]");
  await tap(page, "[data-rs-open]");
  const big = join(tmpdir(), "e2e-big.pdf"); writeFileSync(big, Buffer.alloc(3 * 1024 * 1024 + 16, 37));
  await page.setInputFiles("[data-rs-pdf] input[type=file]", big);
  await page.waitForTimeout(400);
  ok("STOP: PDF больше 3 МБ не берётся, причина словами", /PDF больше 3 МБ: сервер такой не примет\. Сожми файл или вставь текст\./.test(await txt(page, "[data-rs-err]")) && /Прикрепить PDF/.test(await txt(page, "[data-rs-pdf]")), await txt(page, "[data-rs]"));
  const pdf = join(tmpdir(), "e2e-doc.pdf"); writeFileSync(pdf, Buffer.from("%PDF-1.4\n% e2e\n"));
  await page.setInputFiles("[data-rs-pdf] input[type=file]", pdf);
  await page.waitForFunction(() => /e2e-doc\.pdf/.test(document.querySelector("[data-rs-pdf]").textContent), null, { timeout: 5000 });
  const n0 = (await sent(page)).length;
  await page.locator("[data-rs-plan]").click();
  await page.waitForSelector("[data-rs='plan']", { timeout: 15000 });
  const last = (await sent(page))[n0];
  ok("STOP: PDF ушёл файлом, без текста; план пришёл, повтор без галочки", last.mode === "ref_plan" && last.text === "" && last.pdfBase64.length > 10 && (await attrs(page, "data-rs-on")).join() === "0,1,1" && !(await has(page, "[data-rs-err]")), [last.mode, last.text, await attrs(page, "data-rs-on")]);
  ok("STOP: сказано, что PDF уходит заново с каждой главой", /PDF уходит ассистенту заново с каждой главой\. На мобильном интернете лучше подключиться к Wi-Fi\./.test(await txt(page, "[data-rs-pdf-note]")));
  await tap(page, "[data-rs-cancel]");
  ok("STOP: «Отмена» закрывает блок, в разделе ничего не прибавилось", (await has(page, "[data-rs-open]")) && (await secRows(page)).length === 6);
  same("STOP: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── WEB ────────────────────────────────────────────────────────────────────────────────────────────────
if (on("WEB")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await newChapter(page);
  await spyOpen(page);
  await page.fill("[data-re-ch-title]", "Подача игристого");
  await tap(page, "[data-ra-btn='topic']");
  ok("WEB: в форме сказано про поиск в интернете и что заметки владельца важнее найденного", /Ассистент поищет факты в интернете и покажет источники\. Твои заметки для него важнее найденного\./.test(await txt(page, "[data-ra-warn]")));
  await page.fill("[data-ra-notes]", "Игристое охлаждаем до 6–8 градусов.\nБокал держим за ножку.");
  await blur(page);
  await page.locator("[data-ra-go='topic']").click();
  ok("WEB: пока идёт поиск, кнопка говорит «Ищу и пишу…»", /Ищу и пишу/.test(await txt(page, "[data-ra-go='topic']")));
  await result(page);
  const s1 = await sent(page);
  ok("WEB: запрос ушёл с поиском", s1.length === 1 && s1[0].mode === "ref_chapter" && s1[0].web === true && s1[0].title === "Подача игристого", s1);
  ok("WEB: под ответом источники, по одному на сайт", (await attrs(page, "data-ra-src")).join() === "https://example.com/demo/service-rules,https://example.org/demo/handbook" && /Источники: example\.com, example\.org/.test(await txt(page, "[data-ra-sources]")), await txt(page, "[data-ra-result]"));
  await tap(page, "[data-ra-src='https://example.org/demo/handbook']");
  same("WEB: ссылка открывается браузером", await page.evaluate(() => window.__opened), ["https://example.org/demo/handbook"]);
  ok("WEB: пометки «без интернета» нет; черновик назван черновиком", !(await has(page, "[data-ra-noweb]")) && /Это черновик\. Проверь факты перед записью\./.test(await txt(page, "[data-ra-result]")));
  await page.locator("[data-ra]").scrollIntoViewIfNeeded();
  await shot(page, "web-sources");
  await tap(page, "[data-ra-take='replace']");
  ok("WEB: глава взята в текст", /^\*\*Главное\*\*\n1\. Игристое охлаждаем до 6–8 градусов/.test(await val(page, "[data-re-ch-body]")), await val(page, "[data-re-ch-body]"));
  // поиск не ответил: глава пишется без него
  await flag(page, "noweb");
  await page.fill("[data-re-ch-body]", "");
  await tap(page, "[data-ra-btn='topic']");
  await blur(page);
  await page.locator("[data-ra-go='topic']").click();
  await result(page);
  const s2 = (await sent(page)).slice(1);
  ok("WEB: поиск не ответил — тот же запрос ушёл второй раз, уже без поиска", s2.length === 2 && s2[0].web === true && !("web" in s2[1]) && s2[1].title === s2[0].title && s2[1].text === s2[0].text, s2);
  ok("WEB: под ответом сказано, что он без интернета, и почему; источников нет", /Без интернета: поиск сейчас не ответил \(Ошибка OpenRouter: поиск не ответил\)\./.test(await txt(page, "[data-ra-noweb]")) && !(await has(page, "[data-ra-sources]")), await txt(page, "[data-ra-result]"));
  await page.locator("[data-ra]").scrollIntoViewIfNeeded();
  await shot(page, "web-noweb");
  await tap(page, "[data-ra-cancel]");
  // «Глава из материала» в интернет не ходит: своему документу интернет не указ
  await flag(page, "");
  await tap(page, "[data-ra-btn='doc']");
  await page.fill("[data-ra-material]", "Игристое открываем без хлопка.\nПробку придерживаем салфеткой.\nНаливаем в два приёма.");
  await blur(page);
  await page.locator("[data-ra-go='doc']").click();
  await result(page);
  const s3 = (await sent(page)).slice(-1)[0];
  ok("WEB: «Глава из материала» в интернет не ходит", s3.mode === "ref_chapter" && !("web" in s3) && !(await has(page, "[data-ra-sources]")) && !(await has(page, "[data-ra-noweb]")), s3);
  same("WEB: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── CHECK ──────────────────────────────────────────────────────────────────────────────────────────────
const FACTS = "Белое вино подаём при 8 градусах.\n[img:glass_flute]\nКрасное держим в зале и подаём комнатным.\nИгристое открываем за 2 минуты до подачи.\nБокал держим за ножку, а не за чашу.";
const FIXED = FACTS.replace("до подачи.", "до подачи. (уточнено по источникам)");
if (on("CHECK")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await newChapter(page);
  await spyOpen(page);
  ok("CHECK: в пустой главе «Проверить факты» закрыта", await page.evaluate(() => document.querySelector("[data-ra-btn='check']").disabled));
  await page.fill("[data-re-ch-title]", "Подача вина");
  await page.fill("[data-re-ch-body]", FACTS);
  await setSel(page, null, null);
  await blur(page);
  ok("CHECK: с текстом кнопка открыта; подсказка про выделение говорит и о проверке", !(await page.evaluate(() => document.querySelector("[data-ra-btn='check']").disabled)) && /ассистент улучшит, сократит или проверит только их/.test(await txt(page, "[data-ra]")));
  await page.locator("[data-ra-btn='check']").click();
  ok("CHECK: пока идёт проверка, сказано, что это до минуты", /Проверяю в интернете\. Это может занять до минуты\./.test(await txt(page, "[data-ra-busy]")));
  await page.waitForSelector("[data-ra-check]", { timeout: 15000 });
  const c1 = (await sent(page))[0];
  ok("CHECK: ассистенту ушёл текст главы, режим ref_check", c1.mode === "ref_check" && c1.text === FACTS, c1);
  const notes = await page.evaluate(() => [...document.querySelectorAll("[data-ra-note]")].map((el) => [el.getAttribute("data-ra-note"), el.innerText.replace(/\s+/g, " ").trim()]));
  ok("CHECK: вывод и два замечания со словами из текста, оба отмечены", /Демо: проверка показана на строках с цифрами\./.test(await txt(page, "[data-ra-check-sum]")) && notes.length === 2 && notes.every((n) => n[0] === "on")
    && /«Белое вино подаём при 8 градусах»/.test(notes[0][1]) && /«Игристое открываем за 2 минуты до подачи»/.test(notes[1][1]), notes);
  ok("CHECK: источники и оговорка: правила ресторана ассистент не оценивает", /Источники: example\.com, example\.org/.test(await txt(page, "[data-ra-sources]")) && /Правила вашего ресторана ассистент не оценивает\. Замечания сверь по ссылкам: решение за тобой\./.test(await txt(page, "[data-ra-check]")));
  await tap(page, "[data-ra-src='https://example.com/demo/service-rules']");
  same("CHECK: ссылка открывается браузером", await page.evaluate(() => window.__opened), ["https://example.com/demo/service-rules"]);
  await page.locator("[data-ra]").scrollIntoViewIfNeeded();
  await shot(page, "check-notes");
  // сняли обе галочки — править нечего; вернули одну
  await page.locator("[data-ra-note] input").nth(0).click();
  await page.locator("[data-ra-note] input").nth(1).click();
  ok("CHECK: без отмеченных замечаний «Поправить отмеченное» закрыта", await page.evaluate(() => document.querySelector("[data-ra-amend]").disabled));
  await page.locator("[data-ra-note] input").nth(1).click();
  await page.locator("[data-ra-amend]").click();
  ok("CHECK: пока идёт правка, сказано «Правлю по замечаниям…»", /Правлю по замечаниям/.test(await txt(page, "[data-ra-busy]")));
  await result(page);
  const a1 = (await sent(page))[1];
  ok("CHECK: на правку ушли текст и только отмеченное замечание", a1.mode === "ref_amend" && a1.text === FACTS && /^1\. «Игристое открываем за 2 минуты до подачи»: /.test(a1.fixes) && !/Белое вино/.test(a1.fixes), a1);
  const pv = await txt(page, "[data-ra-preview]");
  ok("CHECK: правка видна как глава: изменена только строка с отмеченным замечанием", /Игристое открываем за 2 минуты до подачи\. \(уточнено по источникам\)/.test(pv) && !/8 градусах\. \(уточнено/.test(pv) && /Было \d+ знак\S*, стало \d+ знак/.test(await txt(page, "[data-ra-stat]")), pv);
  await tap(page, "[data-ra-cancel]");
  ok("CHECK: «К замечаниям» возвращает к замечаниям, галочки те же", (await has(page, "[data-ra-check]")) && (await attrs(page, "data-ra-note")).join() === "off,on" && !(await has(page, "[data-ra-result]")));
  await page.locator("[data-ra-amend]").click();
  await result(page);
  await tap(page, "[data-ra-take='replace']");
  ok("CHECK: «Заменить текст» — правка в главе, схема на месте, есть «Вернуть прежний текст»", (await val(page, "[data-re-ch-body]")) === FIXED && (await has(page, "[data-ra-undo-btn]")) && !(await has(page, "[data-ra-check]")), await val(page, "[data-re-ch-body]"));
  await tap(page, "[data-ra-undo-btn]");
  ok("CHECK: «Вернуть прежний текст» возвращает текст", (await val(page, "[data-re-ch-body]")) === FACTS);
  // выделенные строки: проверяются и правятся только они
  await setSel(page, "Игристое открываем", "за чашу.");
  await page.locator("[data-ra-btn='check']").click();
  await page.waitForSelector("[data-ra-check]", { timeout: 15000 });
  const c2 = (await sent(page)).slice(-1)[0];
  ok("CHECK: выделил строки — проверяются только они", c2.mode === "ref_check" && c2.text === "Игристое открываем за 2 минуты до подачи.\nБокал держим за ножку, а не за чашу." && /Проверка выделенных строк/.test(await txt(page, "[data-ra-check]")) && (await attrs(page, "data-ra-note")).length === 1, c2);
  await page.locator("[data-ra-amend]").click();
  await result(page);
  ok("CHECK: правка выделенного: «Заменить фрагмент»", /Заменить фрагмент/.test(await txt(page, "[data-ra-take='replace']")) && /Выделенный фрагмент\./.test(await txt(page, "[data-ra-stat]")) && !(await has(page, "[data-ra-whole]")));
  await tap(page, "[data-ra-take='replace']");
  ok("CHECK: заменён только фрагмент, остальной текст и схема не тронуты", (await val(page, "[data-re-ch-body]")) === FIXED, await val(page, "[data-re-ch-body]"));
  // поиск не ответил
  await flag(page, "noweb");
  await setSel(page, null, null);
  await page.locator("[data-ra-btn='check']").click();
  await page.waitForSelector("[data-ra-err]", { timeout: 15000 });
  ok("CHECK: поиск не ответил — причина словами, текст не тронут", /Не получилось проверить в интернете: Ошибка OpenRouter: поиск не ответил\. Попробуй ещё раз\./.test(await txt(page, "[data-ra-err]")) && !(await has(page, "[data-ra-check]")) && (await val(page, "[data-re-ch-body]")) === FIXED, await txt(page, "[data-ra]"));
  await flag(page, "");
  // текст без мест, которые стоит сверять
  await page.fill("[data-re-ch-body]", "Бокал держим за ножку, а не за чашу.\nБутылку показываем гостю этикеткой.\nПробу наливаем тому, кто заказал вино.");
  await setSel(page, null, null);
  await page.locator("[data-ra-btn='check']").click();
  await page.waitForSelector("[data-ra-check]", { timeout: 15000 });
  ok("CHECK: расхождений нет — так и сказано, править нечего", /Расхождений с источниками ассистент не нашёл\./.test(await txt(page, "[data-ra-check-none]")) && !(await has(page, "[data-ra-amend]")) && (await page.getAttribute("[data-ra-check]", "data-ra-check")) === "0");
  await tap(page, "[data-ra-cancel]");
  ok("CHECK: «Закрыть» убирает проверку", !(await has(page, "[data-ra-check]")) && !(await has(page, "[data-ra-err]")));
  same("CHECK: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── LOOK ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("LOOK")) {
  for (const o of [{ width: 360, height: 800 }, { light: true }, { width: 1280, height: 900 }]) {
    const name = o.light ? "светлая тема" : o.width + " px", tag = o.light ? "light" : String(o.width);
    const { ctx, page, errs } = await start(o);
    await toPlan(page);
    let lk = await look(page);
    ok("LOOK " + name + ": план глав не вылезает, шрифт не мелкий", lk.scroll && !lk.small && !lk.wide, lk);
    await page.locator("[data-rs]").scrollIntoViewIfNeeded();
    await shot(page, "look-plan-" + tag);
    await page.locator("[data-rs-run]").click();
    await done(page);
    lk = await look(page);
    ok("LOOK " + name + ": итог раскладки не вылезает, шрифт не мелкий", lk.scroll && !lk.small && !lk.wide, lk);
    await page.locator("[data-rs]").scrollIntoViewIfNeeded();
    await shot(page, "look-done-" + tag);
    // проверка фактов в одной из новых глав
    await page.locator("[data-re-ch]").nth(1).click();
    await page.waitForSelector("[data-re-screen='ch']");
    await page.fill("[data-re-ch-body]", FACTS);
    await setSel(page, null, null);
    await blur(page);
    await page.locator("[data-ra-btn='check']").click();
    await page.waitForSelector("[data-ra-check]", { timeout: 15000 });
    lk = await look(page);
    ok("LOOK " + name + ": замечания проверки не вылезают, шрифт не мелкий", lk.scroll && !lk.small && !lk.wide, lk);
    if (o.light) {
      const ink = await page.evaluate(() => { const el = document.querySelector("[data-ra-note] span span:last-child"); const m = getComputedStyle(el).color.match(/\d+/g).map(Number); return m[0] + m[1] + m[2]; });
      ok("LOOK светлая тема: текст замечаний тёмный", ink < 300, ink);
    }
    await page.locator("[data-ra-check]").scrollIntoViewIfNeeded();
    await shot(page, "look-check-" + tag);
    same("LOOK " + name + ": ошибок на странице нет", errs, []);
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log("\nитог: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
