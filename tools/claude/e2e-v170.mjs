// e2e v170 (Доп. 495): «Показать все» для глав, которые ассистент разложил из документа. В браузере, на демо целиком
// (tools/claude/demo-app/build.mjs). Модели в демо нет: «ассистент» собирает главы из присланного текста.
//   ALL  — после раскладки над списком глав строка «Из документа: N глав ещё скрыто» и «Показать все (N)»; строка
//          переживает «Готово» и новое открытие приложения; показал одну главу сам — счёт меньше; первое нажатие спрашивает, второе
//          показывает одной записью; скрытое владельцем вручную остаётся скрытым; сотрудник видит новые главы;
//   ONE  — одну из новых глав удалили: осталась одна, кнопка «Показать главу»; в другом разделе строки нет;
//   LOOK — светлая тема, 360 и 1280 px: строка не вылезает, шрифт не мельче 10.5 px.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_ONLY="ALL"] node e2e-v170.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5670, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v170";
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

// в разделе у владельца есть и своя глава, скрытая вручную: «Показать все» трогать её не должна
const MINE = R("rc-mine", "ch", { parent: SEC, title: "Черновик владельца", body: "Текст главы, которую владелец скрыл сам и пока не дописал.", hidden: true });
async function startAll(o = {}) {
  const x = await open({ who: "roman", ...o });
  await seedBook(x.page, [R(SEC, "sec", { title: "Стандарты e2e" }), R("rc-old", "ch", { parent: SEC, title: "Встреча гостя", body: "Старый текст главы про встречу гостя у входа: здороваемся и провожаем к столу." }), MINE]);
  await openSec(x.page);
  return x;
}
const bar = (page) => txt(page, "[data-rs-new]");
const allBtn = (page) => txt(page, "[data-rs-show-all]");
const hiddenOnServer = async (page) => (await secRows(page)).filter((x) => x[1]).map((x) => x[0]);
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("sa_ref_split_new_v1") || "{}"));

// ── ALL ────────────────────────────────────────────────────────────────────────────────────────────────
if (on("ALL")) {
  const { ctx, page, errs } = await startAll();
  ok("ALL: пока ассистент ничего не писал, строки «Из документа» нет, хотя скрытая глава в разделе есть", !(await has(page, "[data-rs-new]")) && (await chList(page)).some((x) => /Черновик владельца.*скрыта/.test(x)), await chList(page));
  await toPlan(page);
  await page.locator("[data-rs-run]").click();
  await done(page);
  ok("ALL: главы написаны — строка «Из документа: 3 главы ещё скрыты» и «Показать все (3)»", /Из документа: 3 главы ещё скрыты\. Проверил\? Покажи команде одной кнопкой\./.test(await bar(page)) && /^Показать все \(3\)$/.test((await allBtn(page)).trim()), await bar(page));
  ok("ALL: строка стоит над списком глав, под заголовком «Главы»", await page.evaluate(() => { const b = document.querySelector("[data-rs-new]").getBoundingClientRect(), c = document.querySelector("[data-re-ch]").getBoundingClientRect(); return b.bottom <= c.top + 1; }));
  ok("ALL: в итоге раскладки сказано про кнопку над списком глав", /Или покажи все разом кнопкой над списком глав\./.test(await txt(page, "[data-rs]")));
  same("ALL: номера написанных глав запомнены на телефоне, по разделу", Object.keys(await stored(page)).join() + ":" + (await stored(page))[SEC].length, SEC + ":3");
  await page.locator("[data-rs-new]").scrollIntoViewIfNeeded();
  await shot(page, "all-bar");
  // «Готово» и новый вход в приложение строку не убирают: главы ещё скрыты
  await tap(page, "[data-rs-close]");
  ok("ALL: «Готово» закрыло итог раскладки, а строка осталась", !(await has(page, "[data-rs]")) && /3 главы ещё скрыты/.test(await bar(page)));
  // владелец закрыл приложение и открыл снова (тот же телефон): строка на месте
  await page.evaluate(() => window.__demo.save());
  await page.reload({ waitUntil: "load" });
  await ready(page, errs);
  await openSec(page);
  ok("ALL: приложение открыто заново — строка на месте", /Из документа: 3 главы ещё скрыты\./.test(await bar(page)), await txt(page, "[data-re-screen='sec']"));
  // одну главу владелец показал сам, кнопкой в главе: счёт меньше
  await page.locator("[data-re-ch]").nth(2).click();
  await page.waitForSelector("[data-re-screen='ch']");
  ok("ALL: открыта новая глава «Подача вина», она скрыта", (await val(page, "[data-re-ch-title]")) === "Подача вина" && (await has(page, "[data-re-ch-show]")));
  await tap(page, "[data-re-ch-show]");
  await page.waitForTimeout(500);
  await tap(page, "[data-lens='back']");
  ok("ALL: показал одну главу сам — в строке две, кнопка «Показать все (2)»", /Из документа: 2 главы ещё скрыты\./.test(await bar(page)) && /Показать все \(2\)/.test(await allBtn(page)), await bar(page));
  same("ALL: главу, которую показал сам, телефон больше «из документа» не считает", ((await stored(page))[SEC] || []).length, 2);
  // первое нажатие спрашивает
  await tap(page, "[data-rs-show-all]");
  ok("ALL: первое нажатие спрашивает: «Да, показать 2 главы», их сразу увидят все заведения", /^Да, показать 2 главы$/.test((await allBtn(page)).trim()) && /Их сразу увидят все заведения\./.test(await bar(page)) && (await page.getAttribute("[data-rs-show-all]", "data-rs-show-all")) === "sure");
  same("ALL: после первого нажатия на сервере ничего не изменилось", await hiddenOnServer(page), ["Черновик владельца", "Расчёт", "Прощание с гостем"]);
  await page.locator("[data-rs-new]").scrollIntoViewIfNeeded();
  await shot(page, "all-sure");
  // ушёл из раздела и вернулся — вопрос задаётся заново
  await tap(page, "[data-lens='back']");
  await tap(page, "[data-re-sec='" + SEC + "']");
  ok("ALL: вышел из раздела и вернулся — кнопка снова спрашивает", /^Показать все \(2\)$/.test((await allBtn(page)).trim()));
  await tap(page, "[data-rs-show-all]");
  await tap(page, "[data-rs-show-all]");
  await page.waitForSelector("[data-re-note]", { timeout: 10000 });
  ok("ALL: второе нажатие показало главы: строки нет, сказано, сколько показано", !(await has(page, "[data-rs-new]")) && /Показано: 2 главы\. Команда увидит их, когда откроет справочник\./.test(await txt(page, "[data-re-note]")), await txt(page, "[data-re-screen='sec']"));
  same("ALL: на сервере новые главы видны, а скрытая владельцем осталась скрытой; места и названия те же", await secRows(page),
    [["Черновик владельца", true, 10], ["Встреча гостя", false, 20], ["Подача вина", false, 30], ["Расчёт", false, 40], ["Прощание с гостем", false, 50]]);
  const list = await chList(page);
  ok("ALL: в списке глав пометка «скрыта» осталась только у главы владельца", list.filter((x) => /скрыта/.test(x)).length === 1 && /Черновик владельца/.test(list.find((x) => /скрыта/.test(x))), list);
  same("ALL: память телефона очищена", await stored(page), {});
  await shot(page, "all-done");
  await switchTo(page, errs, "anna");
  await nav(page, "reference", "[data-ref-card]");
  await tap(page, "[data-ref-card='" + SEC + "']");
  same("ALL: сотрудник видит все новые главы по порядку, а скрытую владельцем — нет", await seenBy(page), ["Встреча гостя", "Подача вина", "Расчёт", "Прощание с гостем"]);
  await page.getByText("Расчёт").first().click();
  await page.waitForTimeout(500);
  ok("ALL: глава читается как глава", /Счёт приносим в течение трёх минут/.test(await txt(page)) && !/\*\*/.test(await txt(page)));
  same("ALL: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── ONE ────────────────────────────────────────────────────────────────────────────────────────────────
if (on("ONE")) {
  const { ctx, page, errs } = await startAll();
  await toPlan(page, DOC2);
  await page.locator("[data-rs-run]").click();
  await done(page);
  await tap(page, "[data-rs-close]");
  ok("ONE: две главы из документа скрыты", /Из документа: 2 главы ещё скрыты\./.test(await bar(page)));
  // одну из новых глав владелец удалил
  await page.locator("[data-re-ch]").nth(3).click();
  await page.waitForSelector("[data-re-screen='ch']");
  const gone = await val(page, "[data-re-ch-title]");
  await page.locator("[data-re-ch-del]").scrollIntoViewIfNeeded();
  await tap(page, "[data-re-ch-del]");
  await tap(page, "[data-re-ch-del]");
  await page.waitForSelector("[data-re-screen='sec']");
  ok("ONE: удалил одну новую главу — в строке одна, кнопка «Показать главу»", gone === "Уборка стола" && /Из документа: 1 глава ещё скрыта\./.test(await bar(page)) && /^Показать главу$/.test((await allBtn(page)).trim()), [gone, await bar(page)]);
  // в другом разделе строки нет: память — по разделам
  await tap(page, "[data-lens='back']");
  await tap(page, "[data-re-sec='coffee']");
  ok("ONE: в другом разделе строки «Из документа» нет", (await has(page, "[data-re-screen='sec']")) && !(await has(page, "[data-rs-new]")));
  await tap(page, "[data-lens='back']");
  await tap(page, "[data-re-sec='" + SEC + "']");
  await tap(page, "[data-rs-show-all]");
  ok("ONE: вопрос про одну главу: «Да, показать 1 главу», её сразу увидят все заведения", /^Да, показать 1 главу$/.test((await allBtn(page)).trim()) && /Её сразу увидят все заведения\./.test(await bar(page)), await bar(page));
  await tap(page, "[data-rs-show-all]");
  await page.waitForSelector("[data-re-note]", { timeout: 10000 });
  ok("ONE: показана одна глава, о ней и сказано", !(await has(page, "[data-rs-new]")) && /Показано: 1 глава\. Команда увидит её, когда откроет справочник\./.test(await txt(page, "[data-re-note]")), await txt(page, "[data-re-note]"));
  same("ONE: на сервере скрытой осталась только глава владельца", await hiddenOnServer(page), ["Черновик владельца"]);
  // показанную главу владелец потом скрыл сам: дальше это его решение, строка «Из документа» не возвращается
  await page.locator("[data-re-ch]").nth(2).click();
  await page.waitForSelector("[data-re-screen='ch']");
  const mine = await val(page, "[data-re-ch-title]");
  await page.locator("[data-re-ch-hide]").scrollIntoViewIfNeeded();
  await tap(page, "[data-re-ch-hide]");
  await page.waitForTimeout(500);
  await tap(page, "[data-lens='back']");
  await page.waitForSelector("[data-re-screen='sec']");
  ok("ONE: показанную главу потом скрыл сам — строка «Из документа» не вернулась", mine === "Сервировка стола" && !(await has(page, "[data-rs-new]")) && (await chList(page)).filter((x) => /скрыта/.test(x)).length === 2, [mine, await chList(page)]);
  same("ONE: на сервере скрыты глава владельца и та, что он скрыл сам", await hiddenOnServer(page), ["Черновик владельца", "Сервировка стола"]);
  same("ONE: память телефона пуста", await stored(page), {});
  same("ONE: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── LOOK ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("LOOK")) {
  for (const o of [{ width: 360, height: 800 }, { light: true }, { width: 1280, height: 900 }]) {
    const name = o.light ? "светлая тема" : o.width + " px", tag = o.light ? "light" : String(o.width);
    const { ctx, page, errs } = await startAll(o);
    await toPlan(page);
    await page.locator("[data-rs-run]").click();
    await done(page);
    await tap(page, "[data-rs-close]");
    await page.locator("[data-rs-new]").scrollIntoViewIfNeeded();
    let lk = await look(page);
    ok("LOOK " + name + ": строка «Из документа» не вылезает, шрифт не мелкий", (await has(page, "[data-rs-new]")) && lk.scroll && !lk.small && !lk.wide, lk);
    await shot(page, "look-bar-" + tag);
    await tap(page, "[data-rs-show-all]");
    lk = await look(page);
    ok("LOOK " + name + ": с вопросом «Да, показать…» тоже", /Да, показать 3 главы/.test(await allBtn(page)) && lk.scroll && !lk.small && !lk.wide, lk);
    if (o.light) {
      const ink = await page.evaluate(() => { const el = document.querySelector("[data-rs-new] div div"); const m = getComputedStyle(el).color.match(/\d+/g).map(Number); return m[0] + m[1] + m[2]; });
      ok("LOOK светлая тема: текст строки тёмный", ink < 300, ink);
    }
    await shot(page, "look-sure-" + tag);
    same("LOOK " + name + ": ошибок на странице нет", errs, []);
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log("\nитог: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
