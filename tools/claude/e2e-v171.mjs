// e2e v171 (Доп. 496): строка «Из документа» видна с любого устройства. В браузере, на демо целиком
// (tools/claude/demo-app/build.mjs). Модели в демо нет: «ассистент» собирает главы из присланного текста.
// «Другое устройство» — смена человека в демо и обратно: демо при этом стирает память приложения, а сервер остаётся.
//   EVERY — главы написаны на одном устройстве, строка и «Показать все» есть на другом: пометка лежит на сервере, телефон
//           ничего не запоминает; правка текста и перестановка пометку не снимают; глава, которую владелец показал и
//           потом скрыл сам, в счёт не идёт ни на одном устройстве; «Показать все» с третьего устройства;
//   MOVE  — новую главу перенесли в другой раздел, не показывая: строка появляется там (в v170 глава из счёта пропадала);
//   OLD   — главы, которые запомнила сборка v170: на том же телефоне считаются как раньше, вместе с новыми; на другом
//           устройстве считаются только главы с пометкой.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_ONLY="EVERY"] node e2e-v171.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5671, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v171";
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
async function startAll(o = {}, more = []) {
  const x = await open({ who: "roman", ...o });
  await seedBook(x.page, [R(SEC, "sec", { title: "Стандарты e2e" }), R("rc-old", "ch", { parent: SEC, title: "Встреча гостя", body: "Старый текст главы про встречу гостя у входа: здороваемся и провожаем к столу." }), MINE, ...more]);
  await openSec(x.page);
  return x;
}
const bar = (page) => txt(page, "[data-rs-new]");
const allBtn = (page) => txt(page, "[data-rs-show-all]");
const hiddenOnServer = async (page) => (await secRows(page)).filter((x) => x[1]).map((x) => x[0]);
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("sa_ref_split_new_v1") || "{}"));
// пометка «из документа» на сервере: названия глав с ней, по местам; и где они лежат
const marks = (page) => page.evaluate(() => Object.values(window.__demo.srv.S.rb.items).filter((x) => x.kind === "ch" && x.sub === "doc").sort((p, q) => (p.sort || 0) - (q.sort || 0)).map((x) => x.title));
const marksAt = (page) => page.evaluate(() => Object.values(window.__demo.srv.S.rb.items).filter((x) => x.kind === "ch" && x.sub === "doc").map((x) => [x.title, x.parent]).sort());
const rowOf = (page, title) => page.evaluate((t) => { const r = Object.values(window.__demo.srv.S.rb.items).find((x) => x.kind === "ch" && x.title === t); return r ? { parent: r.parent, hidden: r.hidden, sub: r.sub, body: r.body } : null; }, title);
// другое устройство: демо при смене человека стирает память приложения (остаётся только сервер), потом снова входит владелец
async function otherDevice(page, errs, via = "anna") {
  await page.evaluate(() => localStorage.setItem("sa_e2e_canary", "1"));
  await switchTo(page, errs, via);
  await switchTo(page, errs, "roman");
  return page.evaluate(() => ({ canary: localStorage.getItem("sa_e2e_canary"), mem: localStorage.getItem("sa_ref_split_new_v1"), who: window.__demo.who }));
}
const write = async (page, doc) => { await toPlan(page, doc); await page.locator("[data-rs-run]").click(); await done(page); await tap(page, "[data-rs-close]"); };

// ── EVERY ──────────────────────────────────────────────────────────────────────────────────────────────
if (on("EVERY")) {
  const { ctx, page, errs } = await startAll();
  await write(page);
  ok("EVERY: главы написаны — «Из документа: 3 главы ещё скрыты»", /Из документа: 3 главы ещё скрыты\./.test(await bar(page)), await bar(page));
  same("EVERY: пометка «из документа» лежит на сервере у трёх глав; телефон ничего не запомнил", [await marks(page), await stored(page)], [["Подача вина", "Расчёт", "Прощание с гостем"], {}]);
  // владелец взял другое устройство
  same("EVERY: другое устройство — память приложения пуста, вошёл владелец", await otherDevice(page, errs), { canary: null, mem: null, who: "roman" });
  await openSec(page);
  ok("EVERY: на другом устройстве строка на месте: «Из документа: 3 главы ещё скрыты» и «Показать все (3)»",
    /Из документа: 3 главы ещё скрыты\. Проверил\? Покажи команде одной кнопкой\./.test(await bar(page)) && /^Показать все \(3\)$/.test((await allBtn(page)).trim()), await txt(page, "[data-re-screen='sec']"));
  ok("EVERY: строка стоит над списком глав", await page.evaluate(() => { const b = document.querySelector("[data-rs-new]").getBoundingClientRect(), c = document.querySelector("[data-re-ch]").getBoundingClientRect(); return b.bottom <= c.top + 1; }));
  await page.locator("[data-rs-new]").scrollIntoViewIfNeeded();
  await shot(page, "every-other-device");
  // там же поправил текст новой главы: она по-прежнему ждёт показа
  await page.locator("[data-re-ch]").nth(3).click();
  await page.waitForSelector("[data-re-screen='ch']");
  const fixed = await val(page, "[data-re-ch-title]");
  await page.fill("[data-re-ch-body]", "Счёт приносим в течение трёх минут.\nСдачу отдаём до копейки.\nЧаевые не просим.");
  await blur(page);
  await tap(page, "[data-re-save]");
  await page.waitForSelector("[data-re-screen='sec']");
  const after = await rowOf(page, "Расчёт");
  ok("EVERY: поправил текст новой главы — в строке по-прежнему три, пометка на сервере цела, текст новый",
    fixed === "Расчёт" && /Из документа: 3 главы ещё скрыты\./.test(await bar(page)) && after && after.sub === "doc" && after.hidden === true && /Чаевые не просим\./.test(after.body), [fixed, await bar(page), after]);
  // переставил: «Расчёт» выше «Подачи вина»
  await page.locator("[data-re-ch]").nth(3).locator("[data-re-up]").click();
  await page.waitForTimeout(600);
  same("EVERY: переставил новые главы — порядок новый, пометки на месте", await marks(page), ["Расчёт", "Подача вина", "Прощание с гостем"]);
  ok("EVERY: и строка по-прежнему считает три", /Из документа: 3 главы ещё скрыты\./.test(await bar(page)), await bar(page));
  // одну главу показал сам, кнопкой в главе, а потом сам же скрыл: дальше это его решение
  await page.locator("[data-re-ch]").nth(4).click();
  await page.waitForSelector("[data-re-screen='ch']");
  const bye = await val(page, "[data-re-ch-title]");
  await tap(page, "[data-re-ch-show]");
  await page.waitForTimeout(500);
  same("EVERY: показал главу кнопкой в главе — пометка с неё снята", [bye, await marks(page)], ["Прощание с гостем", ["Расчёт", "Подача вина"]]);
  await page.locator("[data-re-ch-hide]").scrollIntoViewIfNeeded();
  await tap(page, "[data-re-ch-hide]");
  await page.waitForTimeout(500);
  await tap(page, "[data-lens='back']");
  await page.waitForSelector("[data-re-screen='sec']");
  ok("EVERY: потом сам её скрыл — в строке две главы, не три", /Из документа: 2 главы ещё скрыты\./.test(await bar(page)) && /^Показать все \(2\)$/.test((await allBtn(page)).trim()), await bar(page));
  same("EVERY: на сервере скрыты четыре главы, пометка у двух", [await hiddenOnServer(page), await marks(page)], [["Черновик владельца", "Расчёт", "Подача вина", "Прощание с гостем"], ["Расчёт", "Подача вина"]]);
  // третье устройство: счёт тот же, отсюда и показывает
  same("EVERY: третье устройство — память приложения пуста", await otherDevice(page, errs, "maria"), { canary: null, mem: null, who: "roman" });
  await openSec(page);
  ok("EVERY: на третьем устройстве в строке те же две главы", /Из документа: 2 главы ещё скрыты\./.test(await bar(page)) && /^Показать все \(2\)$/.test((await allBtn(page)).trim()), await bar(page));
  await tap(page, "[data-rs-show-all]");
  ok("EVERY: первое нажатие спрашивает: «Да, показать 2 главы»", /^Да, показать 2 главы$/.test((await allBtn(page)).trim()) && /Их сразу увидят все заведения\./.test(await bar(page)), await bar(page));
  same("EVERY: после первого нажатия на сервере ничего не изменилось", await marks(page), ["Расчёт", "Подача вина"]);
  await tap(page, "[data-rs-show-all]");
  await page.waitForSelector("[data-re-note]", { timeout: 10000 });
  ok("EVERY: второе нажатие показало главы: строки нет, «Показано: 2 главы»", !(await has(page, "[data-rs-new]")) && /Показано: 2 главы\. Команда увидит их, когда откроет справочник\./.test(await txt(page, "[data-re-note]")), await txt(page, "[data-re-note]"));
  same("EVERY: на сервере скрыты глава владельца и та, что он скрыл сам; пометок не осталось", [await hiddenOnServer(page), await marks(page)], [["Черновик владельца", "Прощание с гостем"], []]);
  await shot(page, "every-shown");
  // и ещё одно устройство: строки больше нет, скрытое владельцем по-прежнему скрыто
  await otherDevice(page, errs);
  await openSec(page);
  const list = await chList(page);
  ok("EVERY: на любом устройстве строки больше нет, а «скрыта» осталась у двух глав владельца", !(await has(page, "[data-rs-new]")) && list.filter((x) => /скрыта/.test(x)).length === 2, list);
  await switchTo(page, errs, "anna");
  await nav(page, "reference", "[data-ref-card]");
  await tap(page, "[data-ref-card='" + SEC + "']");
  same("EVERY: сотрудник видит показанные главы по порядку, скрытые — нет", await seenBy(page), ["Встреча гостя", "Расчёт", "Подача вина"]);
  await page.getByText("Расчёт").first().click();
  await page.waitForTimeout(500);
  ok("EVERY: сотрудник читает исправленный текст", /Чаевые не просим/.test(await txt(page)) && !/\bdoc\b/.test(await txt(page)));
  same("EVERY: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── MOVE ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("MOVE")) {
  const { ctx, page, errs } = await startAll();
  await write(page, DOC2);
  ok("MOVE: две главы из документа скрыты", /Из документа: 2 главы ещё скрыты\./.test(await bar(page)), await bar(page));
  // «Уборку стола» владелец перенёс в «Кофе», не показывая
  await page.locator("[data-re-ch]").nth(3).click();
  await page.waitForSelector("[data-re-screen='ch']");
  const moved = await val(page, "[data-re-ch-title]");
  await page.locator("[data-re-parent='coffee']").scrollIntoViewIfNeeded();
  await tap(page, "[data-re-parent='coffee']");
  await blur(page);
  await tap(page, "[data-re-save]");
  await page.waitForSelector("[data-re-screen='sec']");
  await page.waitForSelector("[data-rs-new]", { timeout: 10000 });
  ok("MOVE: после переноса открыт «Кофе», и строка там: «Из документа: 1 глава ещё скрыта», «Показать главу»",
    moved === "Уборка стола" && /Из документа: 1 глава ещё скрыта\./.test(await bar(page)) && /^Показать главу$/.test((await allBtn(page)).trim()) && /Уборка стола/.test((await chList(page)).slice(-1)[0] || ""), [moved, await bar(page), (await chList(page)).slice(-1)]);
  same("MOVE: пометка на сервере у обеих глав, одна теперь в «Кофе»", await marksAt(page), [["Сервировка стола", SEC], ["Уборка стола", "coffee"]]);
  await page.locator("[data-rs-new]").scrollIntoViewIfNeeded();
  await shot(page, "move-coffee");
  // другое устройство: в «Кофе» и в своём разделе — по одной главе
  await otherDevice(page, errs);
  await openSec(page, "coffee");
  ok("MOVE: на другом устройстве в «Кофе» та же строка", /Из документа: 1 глава ещё скрыта\./.test(await bar(page)), await bar(page));
  await tap(page, "[data-lens='back']");
  await tap(page, "[data-re-sec='" + SEC + "']");
  ok("MOVE: в своём разделе осталась одна новая глава", /Из документа: 1 глава ещё скрыта\./.test(await bar(page)) && (await chList(page)).length === 3, [await bar(page), await chList(page)]);
  // показал ту, что в «Кофе»
  await tap(page, "[data-lens='back']");
  await tap(page, "[data-re-sec='coffee']");
  await tap(page, "[data-rs-show-all]");
  ok("MOVE: вопрос про одну главу: «Да, показать 1 главу», её сразу увидят все заведения", /^Да, показать 1 главу$/.test((await allBtn(page)).trim()) && /Её сразу увидят все заведения\./.test(await bar(page)), await bar(page));
  await tap(page, "[data-rs-show-all]");
  await page.waitForSelector("[data-re-note]", { timeout: 10000 });
  ok("MOVE: показана одна глава", !(await has(page, "[data-rs-new]")) && /Показано: 1 глава\. Команда увидит её, когда откроет справочник\./.test(await txt(page, "[data-re-note]")), await txt(page, "[data-re-note]"));
  const got = await rowOf(page, "Уборка стола");
  same("MOVE: «Уборка стола» видна в «Кофе», пометка снята; «Сервировка стола» по-прежнему ждёт показа", [got && [got.parent, got.hidden, got.sub], await marksAt(page)], [["coffee", false, null], [["Сервировка стола", SEC]]]);
  await switchTo(page, errs, "anna");
  await nav(page, "reference", "[data-ref-card]");
  await tap(page, "[data-ref-card='coffee']");
  ok("MOVE: сотрудник видит «Уборку стола» последней главой «Кофе»", (await seenBy(page)).slice(-1)[0] === "Уборка стола", await seenBy(page));
  same("MOVE: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── OLD ────────────────────────────────────────────────────────────────────────────────────────────────
// главы, написанные сборкой v170: скрыты, пометки на сервере нет, их номера помнит только тот телефон
const OLD170 = [R("rc-v170a", "ch", { parent: SEC, title: "Подача вина", body: "Бутылку показываем гостю этикеткой. Пробу наливаем тому, кто заказал.", hidden: true, sort: 30 }),
  R("rc-v170b", "ch", { parent: SEC, title: "Расчёт", body: "Счёт приносим в течение трёх минут. Сдачу отдаём до копейки.", hidden: true, sort: 40 })];
const remember170 = (page) => page.evaluate((sec) => localStorage.setItem("sa_ref_split_new_v1", JSON.stringify({ [sec]: ["rc-v170a", "rc-v170b"] })), SEC);
if (on("OLD")) {
  // тот же телефон: прежние главы считаются как раньше, вместе с новыми
  {
    const { ctx, page, errs } = await startAll({}, OLD170);
    ok("OLD: память телефона пуста — глав, написанных сборкой v170, строка не знает", !(await has(page, "[data-rs-new]")) && (await chList(page)).filter((x) => /скрыта/.test(x)).length === 3, await chList(page));
    await remember170(page);
    await tap(page, "[data-lens='back']");
    await tap(page, "[data-re-sec='" + SEC + "']");
    ok("OLD: телефон помнит главы сборки v170 — строка считает их как раньше", /Из документа: 2 главы ещё скрыты\./.test(await bar(page)), await bar(page));
    await write(page, DOC2);
    ok("OLD: ассистент дописал ещё две — в строке четыре: две по памяти телефона и две по пометке", /Из документа: 4 главы ещё скрыты\./.test(await bar(page)) && /^Показать все \(4\)$/.test((await allBtn(page)).trim()), await bar(page));
    same("OLD: пометка на сервере только у новых; память телефона не пополнилась", [await marks(page), (await stored(page))[SEC]], [["Сервировка стола", "Уборка стола"], ["rc-v170a", "rc-v170b"]]);
    await tap(page, "[data-rs-show-all]");
    await tap(page, "[data-rs-show-all]");
    await page.waitForSelector("[data-re-note]", { timeout: 10000 });
    ok("OLD: «Показать все» показало все четыре", !(await has(page, "[data-rs-new]")) && /Показано: 4 главы\./.test(await txt(page, "[data-re-note]")), await txt(page, "[data-re-note]"));
    same("OLD: скрытой осталась только глава владельца; пометок нет, память телефона пуста", [await hiddenOnServer(page), await marks(page), await stored(page)], [["Черновик владельца"], [], {}]);
    same("OLD: ошибок на странице нет", errs, []);
    await ctx.close();
  }
  // другое устройство: считаются только главы с пометкой; прежние остаются скрытыми и показываются по одной
  {
    const { ctx, page, errs } = await startAll({}, OLD170);
    await remember170(page);
    await write(page, DOC2);
    ok("OLD: на своём телефоне в строке четыре главы", /Из документа: 4 главы ещё скрыты\./.test(await bar(page)), await bar(page));
    await otherDevice(page, errs);
    await openSec(page);
    ok("OLD: на другом устройстве — две: только главы с пометкой на сервере", /Из документа: 2 главы ещё скрыты\./.test(await bar(page)) && /^Показать все \(2\)$/.test((await allBtn(page)).trim()), await bar(page));
    await tap(page, "[data-rs-show-all]");
    await tap(page, "[data-rs-show-all]");
    await page.waitForSelector("[data-re-note]", { timeout: 10000 });
    same("OLD: показаны две новые; главы сборки v170 и глава владельца остались скрытыми", (await hiddenOnServer(page)).sort(), ["Подача вина", "Расчёт", "Черновик владельца"]);
    // прежнюю главу показывают по одной, кнопкой в главе
    await page.locator("[data-re-ch='rc-v170a']").click();
    await page.waitForSelector("[data-re-screen='ch']");
    await tap(page, "[data-re-ch-show]");
    await page.waitForTimeout(500);
    same("OLD: прежняя глава показана кнопкой «Показать главу»", (await hiddenOnServer(page)).sort(), ["Расчёт", "Черновик владельца"]);
    same("OLD: ошибок на странице нет", errs, []);
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log("\nитог: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
