// e2e v167 (Доп. 492): редактор справочника, часть первая — в браузере, на демо целиком (tools/claude/demo-app/build.mjs).
// Сервер демо (fake-server.js) повторяет этап 53: правки хранятся в его состоянии, владелец — Роман, руководитель —
// Мария, сотрудник — Анна. Состояние сервера демо живёт в localStorage страницы, поэтому «владелец поправил, сотрудник
// увидел» проверяется сменой человека в той же вкладке.
//   HUB    — без правок справочник прежний; «Редактор» только у владельца (в справочнике и в «Управлении»);
//   FLOW   — раздел → глава с оформлением и схемой → «Как увидит сотрудник» → записать → карточка в справочнике, глава,
//            «Править главу» → редактор сразу на главе → назад в главу → назад к программе раздела;
//   PHOTO  — фото в текст с подписью: лист, вставка строкой, предпросмотр, глава у сотрудника, плитка в списке глав;
//            передумал — фото с сервера убрано;
//   ORDER  — порядок разделов и глав, скрыть, своё название штатной главе, «Вернуть как было»;
//   MOVE   — штатная глава в свой раздел; раздел удалили — глава вернулась домой, фото раздела убраны;
//   DRAFT  — черновик главы на телефоне: ушёл не записав, вернулся, «Начать заново»;
//   STAFF  — сотрудник видит правки: хаб, поиск, глава; редактора у него нет;
//   NO53   — сервер без этапа 53: справочник прежний, владельцу — что запустить;
//   LOOK   — светлая тема, узкий и широкий экран: ничего не вылезает, шрифт не мельче 10.5 px.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_ONLY="HUB FLOW …"] node e2e-v167.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5667, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v167";
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
    if (el.closest("svg")) continue;   // v168: буквы внутри значка (знак «AI» у ассистента) — рисунок, а не текст
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

// ── HUB ────────────────────────────────────────────────────────────────────────────────────────────────
if (on("HUB")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await nav(page, "reference", "[data-ref-card]");
  same("HUB: без правок у сотрудника справочник прежний", await attrs(page, "data-ref-card"), BASE_CARDS);
  ok("HUB: у сотрудника кнопки «Редактор» нет", !(await has(page, "[data-ref-edit]")));
  await nav(page, "refEditor");
  ok("HUB: экран редактора сотруднику не открывается", !(await has(page, "[data-re-screen]")));
  await switchTo(page, errs, "maria");
  await nav(page, "reference", "[data-ref-card]");
  ok("HUB: у руководителя кнопки «Редактор» нет (редактор только у владельца)", !(await has(page, "[data-ref-edit]")));
  let mg = await management(page);
  ok("HUB: у руководителя в «Управлении» есть «Редактор контента», «Редактора справочника» нет", /Редактор контента/.test(mg) && !/Редактор справочника/.test(mg), mg.slice(0, 300));
  await switchTo(page, errs, "roman");
  mg = await management(page);
  ok("HUB: у владельца в «Управлении» — «Редактор справочника» сразу за «Редактором контента»", /Редактор контента Уроки и материалы команды › Редактор справочника Разделы, главы, текст и фото/.test(mg), mg.slice(0, 500));
  await page.getByText("Редактор справочника").first().click();
  await page.waitForSelector("[data-re-screen='list']", { timeout: 15000 }).catch(() => {});
  ok("HUB: из «Управления» открывается редактор", await has(page, "[data-re-screen='list']"));
  same("HUB: в редакторе штатные разделы; «Бар: Основы» — в общем списке (v172: раньше стоял отдельно)", await attrs(page, "data-re-sec"), ["serving", "wine", "coffee", "bar"]);
  ok("HUB: блока «Отдельно» в редакторе нет (v172)", !/Отдельно/.test(await txt(page)) && /Бар: Основы/.test(await txt(page)), (await txt(page)).slice(0, 400));
  ok("HUB: про «Гид по приложению» сказано, что здесь его нет", /«Гид по приложению» обновляется вместе с приложением/.test(await txt(page)));
  await tap(page, "[data-lens='back']");
  await nav(page, "reference", "[data-ref-card]");
  ok("HUB: у владельца в справочнике кнопка «Редактор»", await has(page, "[data-ref-edit]"));
  await shot(page, "hub-owner");
  same("HUB: без правок ничего не записано на сервер", await rows(page), []);
  same("HUB: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── FLOW ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("FLOW")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await nav(page, "reference", "[data-ref-card]");
  await tap(page, "[data-ref-edit]");
  await page.waitForSelector("[data-re-screen='list']");
  await tap(page, "[data-re-new-sec]");
  await tap(page, "[data-re-new-sec-ok]");
  ok("FLOW: раздел без названия не создаётся", /Назови раздел/.test(await txt(page, "[data-re-err]")));
  await page.fill("[data-re-new-sec-title]", "Стандарты заведения");
  await tap(page, "[data-re-new-sec-ok]");
  await page.waitForSelector("[data-re-screen='sec']");
  ok("FLOW: раздел создан и открыт: «добавь первую главу»", /Раздел создан/.test(await txt(page, "[data-re-note]")) && (await has(page, "[data-re-empty]")));
  await shot(page, "flow-sec-empty");
  await tap(page, "[data-re-new-ch]");
  await page.waitForSelector("[data-re-screen='ch']");
  await blur(page);
  await tap(page, "[data-re-save]");
  ok("FLOW: глава без названия не записывается", /Назови главу/.test(await txt(page, "[data-re-err]")));
  await page.fill("[data-re-ch-title]", "Как мы встречаем гостя");
  await page.fill("[data-re-ch-body]", "Первые секунды\nГость решает, нравится ли ему у нас, за первые десять секунд.\nУлыбка и взгляд\nПриветствие\nПроводить к столу\nНикогда не оставляй гостя у входа одного\nПодойди сам, если хостес занята\nСказать «подождите» и уйти");
  await selLines(page, 0, 0); await tap(page, "[data-re-tool='head']");
  await selLines(page, 2, 4); await tap(page, "[data-re-tool='num']");
  await selLines(page, 5, 5); await tap(page, "[data-re-tool='note']");
  await selLines(page, 6, 6); await tap(page, "[data-re-tool='good']");
  await selLines(page, 7, 7); await tap(page, "[data-re-tool='bad']");
  const body1 = await page.inputValue("[data-re-ch-body]");
  ok("FLOW: кнопки ставят разметку: заголовок, номера, «важно», «верно», «неверно»", /^\*\*Первые секунды\*\*\n/.test(body1) && /\n1\. Улыбка и взгляд\n2\. Приветствие\n3\. Проводить к столу\n/.test(body1) && /\n\u{1F4CC} Никогда/u.test(body1) && /\n\u2705 Подойди/u.test(body1) && /\n\u274C Сказать/u.test(body1), body1);
  await selLines(page, 2, 4); await tap(page, "[data-re-tool='num']");
  ok("FLOW: повторное нажатие снимает оформление", /\nУлыбка и взгляд\nПриветствие\nПроводить к столу\n/.test(await page.inputValue("[data-re-ch-body]")));
  await selLines(page, 2, 4); await tap(page, "[data-re-tool='list']");
  ok("FLOW: те же строки — списком", /\n• Улыбка и взгляд\n• Приветствие\n• Проводить к столу\n/.test(await page.inputValue("[data-re-ch-body]")));
  await page.evaluate(() => { const t = document.querySelector("[data-re-ch-body]"); const i = t.value.indexOf("\n", t.value.indexOf("десять секунд")); t.focus(); t.setSelectionRange(i, i); });
  await tap(page, "[data-re-tool='scheme']");
  await page.waitForSelector("[data-re-scheme-sheet]");
  const tiles = await attrs(page, "data-re-scheme");
  ok("FLOW: лист схем: рисунки и фото из приложения с названиями", tiles.length === 43 && tiles.includes("preset_table") && tiles.includes("wine_pour") && /Базовая сервировка/.test(await txt(page, "[data-re-scheme-sheet]")), tiles.length);
  await shot(page, "flow-scheme-sheet");
  await tap(page, "[data-re-scheme='preset_table']");
  ok("FLOW: схема встала отдельной строкой после своего абзаца", /десять секунд\.\n\[img:preset_table\]\n• Улыбка/.test(await page.inputValue("[data-re-ch-body]")), await page.inputValue("[data-re-ch-body]"));
  await blur(page);
  await tap(page, "[data-re-preview-btn]");
  const pv = await page.evaluate(() => { const p = document.querySelector("[data-re-preview]"); return { t: p.innerText.replace(/\s+/g, " "), svg: p.querySelectorAll("svg").length, raw: /\*\*|\[img:/.test(p.innerText) }; });
  ok("FLOW: «Как увидит сотрудник»: глава без значков разметки, со схемой и пометками", /Как мы встречаем гостя Первые секунды/.test(pv.t) && !pv.raw && pv.svg >= 4, pv);
  await page.locator("[data-re-preview]").scrollIntoViewIfNeeded();
  await shot(page, "flow-preview");
  const lk = await look(page);
  ok("FLOW: в редакторе главы ничего не вылезает и нет мелкого шрифта", lk.scroll && !lk.small && !lk.wide, lk);
  await tap(page, "[data-re-save]");
  await page.waitForSelector("[data-re-screen='sec']");
  ok("FLOW: записано: «команда увидит, когда откроет справочник»; глава в списке с пометкой «своя»", /Глава записана/.test(await txt(page, "[data-re-note]")) && /Как мы встречаем гостя своя/.test(await txt(page)));
  const rw = await rows(page);
  ok("FLOW: на сервере две строки: свой раздел и своя глава в нём", rw.length === 2 && /^rs-/.test(rw[0][0]) && /^rc-/.test(rw[1][0]) && rw[1][2] === rw[0][0], rw);
  ok("FLOW: черновик после записи стёрт", (await page.evaluate(() => localStorage.getItem("sa_ref_draft_v1"))) === null);
  await tap(page, "[data-lens='back']");
  ok("FLOW: в списке разделов свой раздел помечен", /Стандарты заведения 1 глава свой раздел/.test(await txt(page)), await txt(page));
  await tap(page, "[data-lens='back']");
  await page.waitForSelector("[data-ref-card]");
  const cards = await attrs(page, "data-ref-card");
  ok("FLOW: в справочнике карточка своего раздела — после штатных (v172: последний из штатных — «Бар: Основы»)", cards.length === 5 && cards[3] === "bar" && /^rs-/.test(cards[4]), cards);
  ok("FLOW: у карточки своего раздела — рисунок-книга и подпись «1 глава»", (await has(page, "[data-ref-card^='rs-'] [data-ref-art='book']")) && /Стандарты заведения 1 глава/.test(await txt(page, "[data-ref-card^='rs-']")));
  await shot(page, "flow-hub");
  await tap(page, "[data-ref-card^='rs-']");
  ok("FLOW: программа раздела: глава с рисунком из её текста", (await has(page, "[data-ref-chapter^='rc-'] [data-ref-tile='art']")) && /Как мы встречаем гостя Глава 1/.test(await txt(page)));
  await tap(page, "[data-ref-chapter^='rc-']");
  const chT = await txt(page);
  ok("FLOW: глава читается как штатная", /Первые секунды/.test(chT) && /Улыбка и взгляд/.test(chT) && !/\*\*|\[img:/.test(chT), chT.slice(0, 300));
  await shot(page, "flow-chapter");
  ok("FLOW: владельцу в главе — «Править главу»", await has(page, "[data-ref-edit-ch^='rc-']"));
  await tap(page, "[data-ref-edit-ch]");
  await page.waitForSelector("[data-re-screen='ch']");
  ok("FLOW: редактор открылся сразу на этой главе", (await page.inputValue("[data-re-ch-title]")) === "Как мы встречаем гостя");
  await tap(page, "[data-lens='back']");
  await page.waitForTimeout(400);
  ok("FLOW: назад из редактора — в ту же главу", await has(page, "[data-ref-edit-ch^='rc-']"));
  await tap(page, "[data-lens='back']");
  ok("FLOW: ещё раз назад — к программе раздела, не прочь из справочника", await has(page, "[data-ref-chapter^='rc-']"));
  // поправить из главы и записать: возвращает в главу с новым текстом
  await tap(page, "[data-ref-chapter^='rc-']");
  await tap(page, "[data-ref-edit-ch]");
  await page.fill("[data-re-ch-title]", "Встреча гостя");
  await blur(page);
  await tap(page, "[data-re-save]");
  await page.waitForSelector("[data-ref-edit-ch]", { timeout: 15000 }).catch(() => {});
  ok("FLOW: записал из главы — вернулся в неё, название уже новое", /Встреча гостя/.test(await txt(page)) && !/Как мы встречаем гостя/.test(await txt(page)));
  same("FLOW: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── PHOTO ──────────────────────────────────────────────────────────────────────────────────────────────
if (on("PHOTO")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await seedBook(page, [R("rs-e2e", "sec", { title: "Стандарты заведения" }), R("rc-e2e", "ch", { parent: "rs-e2e", title: "Зал утром", body: "Так выглядит зал перед открытием.\nВторой абзац." })]);
  const file = await photoFile(page, "v167-zal.jpg");
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='rs-e2e']");
  await tap(page, "[data-re-ch='rc-e2e']");
  await page.evaluate(() => { const t = document.querySelector("[data-re-ch-body]"); t.focus(); const i = t.value.indexOf("\n"); t.setSelectionRange(i, i); });
  await tap(page, "[data-re-tool='photo']");
  await page.waitForSelector("[data-re-photo-sheet]");
  ok("PHOTO: лист «Фото в текст»: сначала только «Выбрать фото»", (await has(page, "[data-re-photo-pick]")) && !(await has(page, "[data-re-photo-insert]")));
  await page.locator("[data-re-photo-pick] input[type=file]").setInputFiles(file);
  await page.waitForSelector("[data-re-photo-got]", { timeout: 20000 });
  ok("PHOTO: фото загружено на сервер (вся сеть), можно подписать и вставить", (await photosOnServer(page)).some((k) => /^rp:.*\|$/.test(k)) && (await has(page, "[data-re-photo-cap]")), await photosOnServer(page));
  await shot(page, "photo-sheet");
  // передумал: закрыл лист — фото с сервера убрано
  await page.evaluate(() => document.querySelector("[data-re-photo-sheet] [data-sa-back]").click());
  await page.waitForTimeout(400);
  same("PHOTO: закрыл лист, не вставив, — фото на сервере не осталось", await photosOnServer(page), []);
  ok("PHOTO: «назад» Telegram закрывает лист (кнопка листа помечена), глава осталась", !(await has(page, "[data-re-photo-sheet]")) && (await has(page, "[data-re-screen='ch']")));
  // теперь вставляем
  await page.evaluate(() => { const t = document.querySelector("[data-re-ch-body]"); t.focus(); const i = t.value.indexOf("\n"); t.setSelectionRange(i, i); });
  await tap(page, "[data-re-tool='photo']");
  await page.locator("[data-re-photo-pick] input[type=file]").setInputFiles(file);
  await page.waitForSelector("[data-re-photo-got]", { timeout: 20000 });
  await page.fill("[data-re-photo-cap]", "Зал перед открытием");
  await tap(page, "[data-re-photo-insert]");
  const body = await page.inputValue("[data-re-ch-body]");
  const pid = (body.match(/\[photo:(rp:[a-z0-9]+)\|/) || [])[1];
  ok("PHOTO: в тексте — строка фото с подписью, между абзацами", /^Так выглядит зал перед открытием\.\n\[photo:rp:[a-z0-9]+\|Зал перед открытием\]\nВторой абзац\.$/.test(body), body);
  await blur(page);
  await tap(page, "[data-re-preview-btn]");
  await page.waitForSelector("[data-re-preview] [data-ref-own-photo] img", { timeout: 15000 }).catch(() => {});
  ok("PHOTO: в предпросмотре фото и подпись", (await has(page, "[data-re-preview] [data-ref-own-photo] img")) && /Зал перед открытием/.test(await txt(page, "[data-re-preview] figcaption")));
  await page.locator("[data-re-preview]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await shot(page, "photo-preview");
  await tap(page, "[data-re-save]");
  await page.waitForSelector("[data-re-screen='sec']");
  same("PHOTO: после записи на сервере одно фото — то, что в тексте", await photosOnServer(page), [pid + "|"]);
  // сотрудник видит главу с фото, плитка главы — это фото
  await switchTo(page, errs, "anna");
  await nav(page, "reference", "[data-ref-card]");
  await tap(page, "[data-ref-card='rs-e2e']");
  await page.waitForSelector("[data-ref-chapter='rc-e2e']");
  await page.waitForTimeout(600);
  ok("PHOTO: у сотрудника плитка главы — фото из её текста", await has(page, "[data-ref-chapter='rc-e2e'] [data-ref-tile='own']"));
  await tap(page, "[data-ref-chapter='rc-e2e']");
  await page.waitForSelector("[data-ref-own-photo] img", { timeout: 15000 }).catch(() => {});
  const fig = await page.evaluate(() => { const f = document.querySelector("[data-ref-own-photo]"); const i = f && f.querySelector("img"); const r = f ? f.getBoundingClientRect() : null;
    return f ? { img: !!i && i.naturalWidth > 0, cap: f.querySelector("figcaption") ? f.querySelector("figcaption").innerText : "", w: Math.round(r.width), h: Math.round(r.height) } : null; });
  ok("PHOTO: в главе фото во всю ширину текста, с подписью; строки [photo:…] в тексте нет", fig && fig.img && fig.cap === "Зал перед открытием" && fig.w > 300 && fig.h > 180 && !/\[photo:/.test(await txt(page)), fig);
  await shot(page, "photo-chapter-staff");
  // владелец убирает строку фото из текста и записывает — фото с сервера уходит
  await switchTo(page, errs, "roman");
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='rs-e2e']");
  await tap(page, "[data-re-ch='rc-e2e']");
  await page.fill("[data-re-ch-body]", "Так выглядит зал перед открытием.\nВторой абзац.");
  await blur(page);
  await tap(page, "[data-re-save]");
  await page.waitForSelector("[data-re-screen='sec']");
  await page.waitForTimeout(300);
  same("PHOTO: строку фото убрали из текста и записали — фото на сервере не осталось", await photosOnServer(page), []);
  same("PHOTO: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── ORDER ──────────────────────────────────────────────────────────────────────────────────────────────
if (on("ORDER")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await nav(page, "refEditor", "[data-re-screen='list']");
  await page.locator("[data-re-sec='coffee'] [data-re-up]").click(); await page.waitForTimeout(450);
  same("ORDER: «Кофе» поднят выше «Вин»", await attrs(page, "data-re-sec"), ["serving", "coffee", "wine", "bar"]);
  same("ORDER: записаны только те разделы, чьё место изменилось", (await rows(page)).map((r) => [r[0], r[5]]), [["coffee", 20], ["wine", 30]]);
  ok("ORDER: у первого раздела стрелка «выше» не нажимается, у последнего («Бар: Основы», v172) — «ниже»", await page.evaluate(() => document.querySelector("[data-re-sec='serving'] [data-re-up]").disabled && document.querySelector("[data-re-sec='bar'] [data-re-down]").disabled && !document.querySelector("[data-re-sec='wine'] [data-re-down]").disabled));
  await tap(page, "[data-re-sec='wine']");
  await page.locator("[data-re-ch='win-temp'] [data-re-up]").click(); await page.waitForTimeout(450);
  same("ORDER: глава «Температура» стала первой", (await attrs(page, "data-re-ch")).slice(0, 3), ["win-temp", "win-etiquette", "win-glasses"]);
  await tap(page, "[data-re-ch='win-glasses']");
  const base = await page.inputValue("[data-re-ch-title]");
  await page.fill("[data-re-ch-title]", "Бокалы: наши правила");
  await blur(page);
  await tap(page, "[data-re-save]");
  await page.waitForSelector("[data-re-screen='sec']");
  ok("ORDER: штатная глава с новым названием помечена «изменена»", /Бокалы: наши правила изменена/.test(await txt(page)), (await txt(page)).slice(0, 400));
  ok("ORDER: текст штатной главы на сервер не уехал: записано только название", await page.evaluate(() => { const r = window.__demo.srv.S.rb.items["win-glasses"]; return r && r.title === "Бокалы: наши правила" && r.body === null; }));
  await tap(page, "[data-re-ch='win-glasses']");
  await tap(page, "[data-re-ch-hide]");
  ok("ORDER: «Скрыть главу»: записано, кнопка стала «Показать главу»", /Глава скрыта от команды/.test(await txt(page, "[data-re-note]")) && /Показать главу/.test(await txt(page)));
  await shot(page, "order-ch-hidden");
  // сотрудник: порядок, скрытая глава, своё название
  await switchTo(page, errs, "anna");
  await nav(page, "reference", "[data-ref-card]");
  same("ORDER: у сотрудника разделы в новом порядке", await attrs(page, "data-ref-card"), ["serving", "coffee", "wine", "bar"]);
  ok("ORDER: число глав на карточке — без скрытой", /Вина 7 глав/.test(await txt(page, "[data-ref-card='wine']")), await txt(page, "[data-ref-card='wine']"));
  await tap(page, "[data-ref-card='wine']");
  const chs = await attrs(page, "data-ref-chapter");
  ok("ORDER: у сотрудника «Температура» первая, скрытой главы нет", chs[0] === "win-temp" && chs[1] === "win-etiquette" && !chs.includes("win-glasses") && chs.length === 7, chs);
  // владелец: показать, вернуть как было
  await switchTo(page, errs, "roman");
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='wine']");
  ok("ORDER: в редакторе скрытая глава видна и помечена", /Бокалы: наши правила скрыта изменена/.test(await txt(page)), (await txt(page)).slice(0, 400));
  await tap(page, "[data-re-ch='win-glasses']");
  await tap(page, "[data-re-ch-reset]");
  ok("ORDER: «Вернуть как было» спрашивает подтверждение", (await page.getAttribute("[data-re-ch-reset]", "data-re-ch-reset")) === "sure" && /Да, вернуть штатную главу/.test(await txt(page)));
  await tap(page, "[data-re-ch-reset]");
  await page.waitForSelector("[data-re-screen='sec']");
  ok("ORDER: глава снова штатная: прежнее название, видна, строки на сервере нет", new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(await txt(page)) && !(await rows(page)).some((r) => r[0] === "win-glasses"), await rows(page));
  // раздел: своё название, скрыть, вернуть
  await page.fill("[data-re-sec-title]", "Вина мира");
  await tap(page, "[data-re-sec-save]");
  await tap(page, "[data-re-sec-hide]");
  ok("ORDER: раздел переименован и скрыт", (await rows(page)).some((r) => r[0] === "wine" && r[3] === "Вина мира" && r[4] === true), await rows(page));
  await shot(page, "order-sec-hidden");
  await nav(page, "reference", "[data-ref-card]");
  same("ORDER: скрытого раздела в справочнике нет (и у владельца)", await attrs(page, "data-ref-card"), ["serving", "coffee", "bar"]);
  await nav(page, "refEditor", "[data-re-screen='list']");
  ok("ORDER: в редакторе скрытый раздел на месте, с пометками", /Вина мира 8 глав скрыт изменён/.test(await txt(page)), await txt(page));
  await tap(page, "[data-re-sec='wine']");
  await tap(page, "[data-re-sec-reset]"); await tap(page, "[data-re-sec-reset]");
  await page.waitForTimeout(300);
  ok("ORDER: «Вернуть как было» у раздела: название, место и видимость штатные; порядок глав остался", !(await rows(page)).some((r) => r[0] === "wine") && (await attrs(page, "data-re-ch"))[0] === "win-temp" && (await page.inputValue("[data-re-sec-title]")) === "Вина", await rows(page));
  same("ORDER: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── MOVE ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("MOVE")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await seedBook(page, [R("rs-e2e", "sec", { title: "Стандарты заведения" }), R("rc-e2e", "ch", { parent: "rs-e2e", title: "Зал утром", body: "Текст.\n[photo:rp:e2e1|Зал]" })]);
  await page.evaluate(() => { const s = window.__demo.srv, P = "QUJD".repeat(60), T = "REVG".repeat(10); for (const id of ["rp:e2e1", "ref:rs-e2e", "rc-e2e"]) s.rpc("lesson_photo_set", { p_token: "demo-u-roman", p_lesson: id, p_scope: "", p_full: P, p_thumb: T, p_w: 900, p_h: 600 }); window.__demo.save(); });
  await page.reload({ waitUntil: "load" }); await ready(page, errs);
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='serving']");
  await tap(page, "[data-re-ch='srv-types']");
  await page.fill("[data-re-ch-title]", "Виды сервировки у нас");
  await page.locator("[data-re-parent='rs-e2e']").scrollIntoViewIfNeeded();
  await tap(page, "[data-re-parent='rs-e2e']");
  await blur(page);
  await tap(page, "[data-re-save]");
  await page.waitForSelector("[data-re-screen='sec']");
  same("MOVE: после переноса открыт новый раздел, глава в нём последняя", await attrs(page, "data-re-ch"), ["rc-e2e", "srv-types"]);
  ok("MOVE: перенесённая штатная глава помечена", /Виды сервировки у нас изменена перенесена/.test(await txt(page)), await txt(page));
  await shot(page, "move-own-sec");
  await tap(page, "[data-lens='back']");
  ok("MOVE: в «Сервировке» стало пять глав, в своём разделе две", /Сервировка 5 глав/.test(await txt(page)) && /Стандарты заведения 2 главы/.test(await txt(page)), await txt(page));
  await nav(page, "reference", "[data-ref-card]");
  ok("MOVE: в справочнике у своего раздела обложка — своё фото", ["own", "wait"].includes(await page.getAttribute("[data-ref-card='rs-e2e']", "data-ref-cover")));
  await tap(page, "[data-ref-card='rs-e2e']");
  same("MOVE: в справочнике штатная глава — в своём разделе владельца", await attrs(page, "data-ref-chapter"), ["rc-e2e", "srv-types"]);
  // удалить свой раздел
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='rs-e2e']");
  await tap(page, "[data-re-sec-del]");
  ok("MOVE: удаление раздела спрашивает подтверждение и говорит про главы", /Да, удалить раздел и его главы/.test(await txt(page)));
  await tap(page, "[data-re-sec-del]");
  await page.waitForSelector("[data-re-screen='list']");
  await page.waitForTimeout(400);
  same("MOVE: раздел и его глава удалены; штатная глава вернулась домой со своим названием", (await rows(page)).map((r) => [r[0], r[2], r[3], r[5]]), [["srv-types", "", "Виды сервировки у нас", null]]);
  same("MOVE: фото из текста, фото главы и обложка удалённого раздела с сервера убраны", await photosOnServer(page), []);
  await tap(page, "[data-re-sec='serving']");
  ok("MOVE: в «Сервировке» снова шесть глав, перенесённая — на своём месте", (await attrs(page, "data-re-ch")).join() === "srv-basics,srv-types,srv-plates,srv-cutlery,srv-glasses,srv-schools", await attrs(page, "data-re-ch"));
  same("MOVE: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── DRAFT ──────────────────────────────────────────────────────────────────────────────────────────────
if (on("DRAFT")) {
  const { ctx, page, errs } = await open({ who: "roman" });
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='coffee']");
  await tap(page, "[data-re-ch='cof-milk']");
  const was = await page.inputValue("[data-re-ch-title]");
  await page.fill("[data-re-ch-title]", was + " и пена");
  await page.waitForTimeout(900);
  ok("DRAFT: черновик лёг на телефон, внизу — когда сохранён", /Черновик сохранён на телефоне в \d\d:\d\d/.test(await txt(page, "[data-re-bar]")) && !!(await page.evaluate(() => localStorage.getItem("sa_ref_draft_v1"))));
  await tap(page, "[data-lens='back']");
  ok("DRAFT: ушёл не записав — у главы в списке пометка «черновик», на сервере ничего", /черновик/.test(await txt(page, "[data-re-ch='cof-milk']")) && (await rows(page)).length === 0);
  await page.reload({ waitUntil: "load" }); await ready(page, errs);
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='coffee']");
  await tap(page, "[data-re-ch='cof-milk']");
  ok("DRAFT: после перезапуска черновик восстановлен", (await page.inputValue("[data-re-ch-title]")) === was + " и пена" && /Восстановлен черновик от \d\d:\d\d/.test(await txt(page, "[data-re-draft]")));
  await shot(page, "draft-restored");
  await tap(page, "[data-re-draft-drop]");
  ok("DRAFT: «Начать заново» возвращает главу как на сервере и стирает черновик", (await page.inputValue("[data-re-ch-title]")) === was && (await page.evaluate(() => localStorage.getItem("sa_ref_draft_v1"))) === null);
  // новая глава: черновик, «Продолжить новую главу», «Отменить»
  await tap(page, "[data-lens='back']");
  await tap(page, "[data-re-new-ch]");
  await page.fill("[data-re-ch-title]", "Раф");
  await page.waitForTimeout(900);
  await tap(page, "[data-lens='back']");
  ok("DRAFT: недописанная новая глава: кнопка «Продолжить новую главу»", /Продолжить новую главу/.test(await txt(page, "[data-re-new-ch]")));
  await tap(page, "[data-re-new-ch]");
  ok("DRAFT: новая глава продолжена с набранного", (await page.inputValue("[data-re-ch-title]")) === "Раф");
  await blur(page);
  await tap(page, "[data-re-cancel]");
  ok("DRAFT: «Отменить» стирает черновик: снова «Новая глава», на сервере ничего", /^Новая глава$/.test((await txt(page, "[data-re-new-ch]")).trim()) && (await rows(page)).length === 0, await txt(page, "[data-re-new-ch]"));
  same("DRAFT: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── STAFF ──────────────────────────────────────────────────────────────────────────────────────────────
if (on("STAFF")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await seedBook(page, [R("rs-e2e", "sec", { title: "Стандарты заведения", sub: "Как принято у нас" }), R("rc-e2e", "ch", { parent: "rs-e2e", title: "Как мы встречаем гостя", body: "**Первые секунды**\nУлыбка, взгляд и фирменное приветствие «Океана»." }),
    R("rc-hid", "ch", { parent: "rs-e2e", title: "Черновая глава", body: "Секретное слово: каракатица.", hidden: true }), R("srv-basics", "ch", { title: "Основы, по-нашему" }), R("coffee", "sec", { hidden: true })]);
  await page.reload({ waitUntil: "load" }); await ready(page, errs);
  await nav(page, "reference", "[data-ref-card]");
  same("STAFF: хаб: скрытого раздела нет, свой раздел есть", await attrs(page, "data-ref-card"), ["serving", "wine", "bar", "rs-e2e"]);
  ok("STAFF: редактора у сотрудника нет", !(await has(page, "[data-ref-edit]")));
  await tap(page, "[data-ref-card='rs-e2e']");
  ok("STAFF: в разделе подзаголовок владельца и одна глава (скрытой нет)", /Как принято у нас/.test(await txt(page)) && (await attrs(page, "data-ref-chapter")).join() === "rc-e2e");
  await tap(page, "[data-ref-chapter='rc-e2e']");
  ok("STAFF: глава открывается; «Править главу» у сотрудника нет", /фирменное приветствие «Океана»/.test(await txt(page)) && !(await has(page, "[data-ref-edit-ch]")));
  await tap(page, "[data-lens='back']"); await tap(page, "[data-lens='back']");
  await tap(page, "[data-ref-card='serving']");
  ok("STAFF: штатная глава под названием владельца", /Основы, по-нашему/.test(await txt(page)), (await txt(page)).slice(0, 200));
  // поиск по справочнику
  await tap(page, "[data-lens='back']");
  await page.locator("[role='search']").first().click(); await page.waitForTimeout(500);
  const inp = page.locator("input").first();
  await inp.fill("фирменное приветствие"); await page.waitForTimeout(700);
  ok("STAFF: поиск находит свою главу владельца", /Как мы встречаем гостя/.test(await txt(page)), (await txt(page)).slice(0, 300));
  await inp.fill("каракатица"); await page.waitForTimeout(700);
  ok("STAFF: скрытую главу поиск не находит", !/Черновая глава/.test(await txt(page)), (await txt(page)).slice(0, 300));
  await inp.fill("фирменное приветствие"); await page.waitForTimeout(700);
  await page.getByText("Как мы встречаем гостя").first().click(); await page.waitForTimeout(600);
  ok("STAFF: из поиска глава открывается", /Первые секунды/.test(await txt(page)), (await txt(page)).slice(0, 200));
  same("STAFF: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── NO53 ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("NO53")) {
  const { ctx, page, errs } = await open({ who: "anna", flags: { __demo_no53: "1" } });
  await nav(page, "reference", "[data-ref-card]");
  same("NO53: без этапа 53 у сотрудника справочник прежний", await attrs(page, "data-ref-card"), BASE_CARDS);
  await tap(page, "[data-ref-card='serving']");
  ok("NO53: главы открываются как раньше", (await attrs(page, "data-ref-chapter")).length === 6);
  await switchTo(page, errs, "roman");
  await nav(page, "reference", "[data-ref-card]");
  await tap(page, "[data-ref-edit]");
  await page.waitForSelector("[data-re-screen='list']");
  await page.waitForTimeout(500);
  const t = await txt(page);
  ok("NO53: владельцу редактор говорит, какой файл запустить; списка разделов нет", (await has(page, "[data-re-missing]")) && /supabase-stage53-ref-book\.sql/.test(t) && /Проверить ещё раз/.test(t) && !(await has(page, "[data-re-sec]")) && !(await has(page, "[data-re-new-sec]")), t.slice(0, 400));
  await shot(page, "no53");
  await nav(page, "server");
  await page.waitForTimeout(900);
  ok("NO53: на экране «Сервер» этап 53 в списке", /Редактор справочника/.test(await txt(page)), (await txt(page)).slice(0, 200));
  same("NO53: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── LOOK ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("LOOK")) {
  for (const [name, o] of [["светлая тема", { light: true }], ["360 px", { width: 360, height: 760 }], ["1280 px", { width: 1280, height: 860 }]]) {
    const { ctx, page, errs } = await open({ who: "roman", ...o });
    await seedBook(page, [R("rs-e2e", "sec", { title: "Стандарты заведения и правила приёма гостей в зале", sub: "Как принято у нас" }), R("rc-e2e", "ch", { parent: "rs-e2e", title: "Как мы встречаем гостя, провожаем к столу и прощаемся", body: "**Первые секунды**\nУлыбка и взгляд.\n[img:fine_dining_full]" }),
      R("rc-hid", "ch", { parent: "rs-e2e", title: "Скрытая глава", body: "т", hidden: true }), R("coffee", "sec", { hidden: true }), R("srv-basics", "ch", { title: "Основы, по-нашему" })]);
    await nav(page, "refEditor", "[data-re-screen='list']");
    let lk = await look(page);
    ok("LOOK " + name + ": список разделов — ничего не вылезает, шрифт не мелкий", lk.scroll && !lk.small && !lk.wide, lk);
    await shot(page, "look-" + (o.light ? "light" : o.width) + "-list");
    await tap(page, "[data-re-sec='rs-e2e']");
    lk = await look(page);
    ok("LOOK " + name + ": раздел — ничего не вылезает, шрифт не мелкий", lk.scroll && !lk.small && !lk.wide, lk);
    await shot(page, "look-" + (o.light ? "light" : o.width) + "-sec");
    await tap(page, "[data-re-ch='rc-e2e']");
    await tap(page, "[data-re-preview-btn]");
    lk = await look(page);
    ok("LOOK " + name + ": глава с предпросмотром — ничего не вылезает, шрифт не мелкий", lk.scroll && !lk.small && !lk.wide, lk);
    await shot(page, "look-" + (o.light ? "light" : o.width) + "-ch");
    const bar = await page.evaluate(() => { const b = document.querySelector("[data-re-bar]").getBoundingClientRect(); const s = document.querySelector("[data-re-save]").getBoundingClientRect(); return { bottom: Math.round(window.innerHeight - b.bottom), h: Math.round(s.height), in: s.left >= 0 && s.right <= window.innerWidth + 1 }; });
    ok("LOOK " + name + ": «Записать главу» закреплена внизу, кнопка не ниже 40 px", bar.bottom === 0 && bar.h >= 40 && bar.in, bar);
    if (o.light) {
      const ink = await page.evaluate(() => { const t = document.querySelector("[data-re-ch-body]"); const c = getComputedStyle(t).color.match(/\d+/g).map(Number); return c[0] + c[1] + c[2]; });
      ok("LOOK светлая тема: текст в поле тёмный", ink < 250, ink);
    }
    await page.focus("[data-re-ch-title]"); await page.waitForTimeout(450);
    ok("LOOK " + name + ": пока печатаешь, «Записать» уезжает и не закрывает поле", await page.evaluate(() => document.querySelector("[data-re-bar]").getBoundingClientRect().top >= window.innerHeight - 1));
    same("LOOK " + name + ": ошибок на странице нет", errs, []);
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log("\nитог: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
