// e2e v191 (Доп. 516): «О нас» — своё название раздела, «для ознакомления» или «в зачёт», зачёт по роли, «Из документа» в два
// шага (план, блоки в виде уроков, просмотр перед сохранением, Word на телефоне), «Оформить как урок» и «Оформить всё как в
// уроках», «Как в уроке» в правке блока. Сайт — демо целиком (tools/claude/demo-app/build.mjs: сервер в странице, демо-помощник
// «О нас» без модели; __demo_no57 = "1" — сервер без этапа 57; sessionStorage.__e2e_cn: "fail-<вид>" — блок не пишется,
// "nostyle" — оформление не отвечает).
// Разделы:
//   EDIT    — владелец: правка начинается со «Всей сети», вкладки со счётом, карточка «Раздел в обучении» (название, уроки,
//             самопроверка, «Как проходить»), строки блоков со значком и первой мыслью, «Открыть как сотрудник» — раздел в
//             треке; у каждой кнопки и поля метка «Линзы»;
//   RENAME  — «Переименовать»: «Marin Resto Group» и подзаголовок — в карточке и в треке; «Как было» — снова «Наш ресторан»;
//   MODE    — по умолчанию для ознакомления: в треке пометка, «N из M» без шагов раздела; «В зачёт» — шаги в счёте, пометки
//             нет; обратно;
//   ROLE    — урок раздела пройден у «Новичка» — у «Хостес» тот же урок не пройден; снова «Новичок» — пройден;
//   DOC     — «Из документа»: текст → план и блоки (по два сразу) → «как в уроке» (первая мысль, части, пункты, вывод),
//             «Заменить» / «Добавить», галочка снята — не сохраняется; блок, который не написался, —
//             «Повторить»; сохранено — строки в списке и сообщение; Word (.docx) — текст в поле; PDF больше 3 МБ — отказ;
//   BLOCK   — правка блока: «Как в уроке», «Шаги» делают 1️⃣ 2️⃣, «Оформить как урок» и «Вернуть как было», в базе — разметка уроков;
//   RESTYLE — «Оформить всё как в уроках»: «Было / Стало», сохранить; помощник не ответил — только разметка или «как есть»;
//   NO57    — сервер без этапа 57: название по умолчанию, вместо переключателя — текст, «Переименовать» говорит про этап 57;
//   LOOK    — 320 px и «Для чтения»: правка, «Из документа», «как в уроке» — без прокрутки вбок; снимки.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v191.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { deflateRawSync } from "node:zlib";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5791, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v191";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".mp4": "video/mp4", ".svg": "image/svg+xml" };
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1300);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    document.querySelectorAll("[data-badge-new] [data-lens-x], [data-shelf-new] button[aria-label='Закрыть']").forEach((x) => x.click());
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
}
async function open({ who = "roman", light = false, width = 390, height = 844, no57 = false, cn = "" } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n, f]) => { localStorage.clear(); localStorage.setItem("__demo_who", w); if (n) localStorage.setItem("__demo_no57", "1"); if (f) sessionStorage.setItem("__e2e_cn", f); }, [who, no57, cn]);
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
const nav = async (page, s, ms = 1800) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms);
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await page.waitForTimeout(250); };
const txt = async (loc) => ((await loc.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
const body = (page) => txt(page.locator("body"));
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });
const overflowX = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
const until = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(150); } return null; };
const screenName = (page) => page.evaluate(() => (window.__saScreen ? window.__saScreen() : ""));
// «Линза»: видимые кнопки, поля и подписи с файлом без метки data-lens-* (как в e2e-v139). Не в счёт: галочки, выбор файла,
// фото, зелёный кружок верного ответа, невыбранная вкладка в капсуле (линзу даёт капсула data-lens-seg)
const lensMiss = (page) => page.evaluate(() => [...document.querySelectorAll(".sa-screen button, .sa-screen input, .sa-screen textarea, .sa-screen select, .sa-screen label")]
  .filter((e) => e.getClientRects().length && e.type !== "checkbox" && e.type !== "file" && !(e.tagName === "LABEL" && !e.querySelector("input[type=file]")))
  .filter((e) => !e.closest("[data-cn-photo]") && !e.closest("[data-lesson-look]") && !e.matches("[data-cn-right], [data-lens-seg] > button, [data-cn-docpeek]"))
  .filter((e) => ![...e.attributes].some((a) => a.name.startsWith("data-lens")))
  .map((e) => (e.getAttribute("aria-label") || e.innerText || e.tagName).trim().slice(0, 24)));
const editor = async (page) => { await nav(page, "about"); await page.locator("[data-cn-edit]").click(); await page.waitForTimeout(1500);
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); };
// трек: «N из M» над темами
const trackCount = (page) => page.evaluate(() => { const m = (document.body.innerText || "").match(/(\d+)\s*из\s*(\d+)\s*·/); return m ? [Number(m[1]), Number(m[2])] : null; });
const toTrack = async (page, rid) => { await nav(page, "roleSelect", 1200); await page.locator(`[data-track-chip=${rid}]`).click(); await page.waitForTimeout(900);
  await page.locator("[data-track-go]").click(); await page.waitForTimeout(1600); };
const toConceptPage = async (page) => { await page.locator(".tbp-num").first().click(); await page.waitForTimeout(1200); };
const curMenu = (page) => page.evaluate(() => { const m = document.querySelector(".tbp-cur .tbm-menu"); if (!m) return null;
  const t = m.querySelector(".tbm-title"), node = m.querySelector(".tbm-cur, [aria-label^='Начать']");
  return { title: t ? t.textContent.trim() : "", info: !!m.querySelector(".tbm-infonote"), text: (m.innerText || "").replace(/\s+/g, " "), next: node ? node.getAttribute("aria-label") || "" : "" }; });
const toEnd = async (page) => { for (let i = 0; i < 30; i++) { if (await page.locator("button:has-text('Урок пройден')").count()) break; const n = page.locator("span[aria-label='Следующая карточка']"); if (!(await n.count())) break; await n.first().click(); await page.waitForTimeout(350); } };
const bottom = async (page) => { await page.evaluate(() => { const r = document.getElementById("root"); const s = r && r.scrollHeight > r.clientHeight + 5 ? r : document.scrollingElement; s.scrollTop = s.scrollHeight; }); await page.waitForTimeout(350); };

// маленький .docx: ZIP с word/document.xml (сжатие deflate), как сохраняет Word
function docx(xml) {
  const files = [["[Content_Types].xml", "<Types/>"], ["word/document.xml", xml]];
  const parts = [], dir = []; let off = 0;
  for (const [name, text] of files) {
    const nb = Buffer.from(name, "utf8"), raw = Buffer.from(text, "utf8"), data = deflateRawSync(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nb, data); dir.push(Buffer.concat([ch, nb])); off += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(dir), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
const W = (t, st = "") => `<w:p>${st ? `<w:pPr><w:pStyle w:val="${st}"/></w:pPr>` : ""}<w:r><w:t>${t}</w:t></w:r></w:p>`;
const DOCX = docx(`<w:document><w:body>${W("Marin Resto Group", "Heading1")}${W("Мы — семь ресторанов на Камчатке. Начинали в 2012 году с одного зала у порта.")}</w:body></w:document>`);
const DOC = `MARIN RESTO GROUP
Мы — семь ресторанов на Камчатке. Начинали в 2012 году с одного рыбного зала у порта, сегодня в сети морская кухня, мясо на углях и камчатская кухня. Наша идея простая: кормить гостей так, как кормили бы своих близких.

Наши ценности
- Забота: замечаем гостя раньше, чем он попросит.
- Команда: помогаем друг другу, нет «не мой стол».
- Честность: не обещаем того, чего не можем сделать.

Форма: чёрный верх, фартук сети, закрытая чёрная обувь. Волосы собраны, ногти короткие, без яркого лака. Украшения — не больше одного кольца.`;

// ═══ EDIT ═══════════════════════════════════════════════════════════════════════════════════
if (want("EDIT")) {
  const { ctx, page, errs } = await open();
  await editor(page);
  ok("EDIT: владелец начинает со «Всей сети», вкладки со счётом блоков", (await page.locator('[data-about="edit"][data-cn-scope="net"]').count()) === 1
    && /^Вся сеть · \d+$/.test(await txt(page.locator('[data-cn-tab="net"]'))) && /· \d+$/.test(await txt(page.locator('[data-cn-tab="venue"]'))));
  const card = await txt(page.locator("[data-cn-section]"));
  ok("EDIT: «Раздел в обучении» — «Наш ресторан», «Концепция и стандарты», уроки, самопроверка, первым в каждом треке", /Раздел в обучении/i.test(card) && /Наш ресторан/.test(card)
    && /Концепция и стандарты/.test(card) && /\d+ урок/.test(card) && /самопроверка: \d+ вопрос/.test(card) && /первым в каждом треке/.test(card), card);
  ok("EDIT: «Как проходить» — капсула, выбрано «Для ознакомления», про роль сказано", (await page.locator('[data-cn-mode="info"][data-lens-seg]').count()) === 1
    && /засчитывается только в той роли/.test(card));
  const rows = await page.evaluate(() => [...document.querySelectorAll("[data-cn-row]")].map((r) => ({ k: r.getAttribute("data-cn-row"), icon: !!r.querySelector("[data-cn-icon] svg"), lead: !!r.querySelector("[data-cn-lead]") })));
  ok("EDIT: строки блоков — значок вида и первая мысль", rows.length >= 2 && rows.every((r) => r.icon && r.lead), JSON.stringify(rows));
  const miss = await lensMiss(page);
  ok("EDIT: «Линза» — у всех кнопок и полей метки", !miss.length, JSON.stringify(miss));
  await shot(page, "edit");
  // касание по строке открывает правку
  await page.locator("[data-cn-rowtap]").first().click(); await page.waitForTimeout(700);
  ok("EDIT: касание по строке — правка блока", (await page.locator('[data-about="block"]').count()) === 1);
  await page.locator('[data-about="block"] [data-lens="back"]').click(); await page.waitForTimeout(600);
  const first = await txt(page.locator("[data-cn-row] [data-cn-rowtap]").first());
  await page.locator("[data-cn-secopen]").click(); await page.waitForTimeout(2200);
  const les = await page.evaluate(() => ({ glass: !!document.querySelector("[data-lesson-glass]"), t: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 400) }));
  ok("EDIT: «Открыть как сотрудник» — урок раздела, как его видит сотрудник («1 из N»)", les.glass && /1 из \d+/.test(les.t) && les.t.includes(first.split(" ")[0]), JSON.stringify({ les, first }));
  ok("EDIT: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ RENAME ═══════════════════════════════════════════════════════════════════════════════════
if (want("RENAME")) {
  const { ctx, page, errs } = await open();
  await editor(page);
  await page.locator("[data-cn-secedit]").click(); await page.waitForTimeout(300);
  const miss = await lensMiss(page);
  ok("RENAME: поля названия и подзаголовка, подсказка про пусто; «Линза»", (await page.locator("[data-cn-sectin]").count()) === 1 && (await page.locator("[data-cn-secsub]").count()) === 1
    && /Если пусто, будет «Наш ресторан»/.test(await txt(page.locator("[data-cn-section]"))) && !miss.length, JSON.stringify(miss));
  await page.locator("[data-cn-sectin]").fill("  Marin   Resto Group "); await page.locator("[data-cn-secsub]").fill("Кто мы, ценности и стандарты");
  await shot(page, "rename-form");
  await page.locator("[data-cn-secsave]").click();
  ok("RENAME: сохранено — в карточке «Marin Resto Group» и подзаголовок", !!(await until(() => page.locator('[data-cn-section="Marin Resto Group"]').count()))
    && /Кто мы, ценности и стандарты/.test(await txt(page.locator("[data-cn-section]"))) && /Название раздела сохранено/.test(await txt(page.locator("[data-cn-msg]"))));
  await shot(page, "rename-card");
  await toTrack(page, "seasonal"); await toConceptPage(page);
  let m = await curMenu(page);
  ok("RENAME: в треке раздел называется «Marin Resto Group», подзаголовок свой", !!m && m.title === "Marin Resto Group" && /Кто мы, ценности и стандарты/.test(m.text), JSON.stringify(m));
  await shot(page, "rename-track");
  await editor(page);
  await page.locator("[data-cn-secedit]").click(); await page.waitForTimeout(300);
  await page.locator("[data-cn-secreset]").click();
  ok("RENAME: «Как было» — снова «Наш ресторан»", !!(await until(() => page.locator('[data-cn-section="Наш ресторан"]').count())));
  await toTrack(page, "seasonal"); await toConceptPage(page);
  m = await curMenu(page);
  ok("RENAME: и в треке — «Наш ресторан»", !!m && m.title === "Наш ресторан", JSON.stringify(m));
  ok("RENAME: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ MODE ═══════════════════════════════════════════════════════════════════════════════════
if (want("MODE")) {
  const { ctx, page, errs } = await open();
  await toTrack(page, "seasonal");
  const c0 = await trackCount(page);
  await toConceptPage(page);
  let m = await curMenu(page);
  ok("MODE: по умолчанию — для ознакомления: пометка в разделе", !!m && m.info && /для ознакомления/i.test(m.text), JSON.stringify(m));
  await shot(page, "mode-info-track");
  const steps = await page.evaluate(() => document.querySelectorAll(".tbp-cur .tbm-menu [aria-label*=' · ']").length);
  await editor(page);
  await page.locator('[data-cn-mode] [data-seg="credit"]').click();
  ok("MODE: «В зачёт» — сохранено, капсула переехала, слова поменялись", !!(await until(() => page.locator('[data-cn-mode="credit"]').count()))
    && /Раздел теперь в зачёт/.test(await txt(page.locator("[data-cn-msg]"))) && /Как обычная тема/.test(await txt(page.locator("[data-cn-section]"))));
  await toTrack(page, "seasonal");
  const c1 = await trackCount(page);
  ok("MODE: «в зачёт» — шаги раздела в «N из M» (M выросло)", !!c0 && !!c1 && c1[1] > c0[1], JSON.stringify({ c0, c1, steps }));
  await toConceptPage(page);
  m = await curMenu(page);
  ok("MODE: «в зачёт» — пометки «для ознакомления» нет", !!m && !m.info, JSON.stringify(m));
  await editor(page);
  await page.locator('[data-cn-mode] [data-seg="info"]').click();
  ok("MODE: снова «для ознакомления»", !!(await until(() => page.locator('[data-cn-mode="info"]').count())) && /Раздел теперь для ознакомления/.test(await txt(page.locator("[data-cn-msg]"))));
  await toTrack(page, "seasonal");
  const c2 = await trackCount(page);
  ok("MODE: счёт трека — как был", !!c2 && c2[1] === c0[1], JSON.stringify({ c0, c2 }));
  // у заведения — ещё «Как у сети»
  await editor(page);
  await page.locator('[data-cn-tab="venue"]').click(); await page.waitForTimeout(400);
  ok("MODE: у заведения — «Как у сети», «Ознакомление», «В зачёт»; выбрано «Как у сети»", (await page.locator('[data-cn-mode=""] [data-seg]').count()) === 3);
  ok("MODE: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ ROLE ═══════════════════════════════════════════════════════════════════════════════════
if (want("ROLE")) {
  const { ctx, page, errs } = await open();
  await toTrack(page, "seasonal"); await toConceptPage(page);
  const before = await curMenu(page);
  await page.locator(".tbp-cur .tbm-cur").click(); await page.waitForTimeout(2200);
  await toEnd(page); await bottom(page);
  await page.locator("button:has-text('Урок пройден')").last().click(); await page.waitForTimeout(1800);
  const keys = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^sa_completed_/.test(x)); return k ? Object.keys(JSON.parse(localStorage.getItem(k) || "{}")).filter((x) => /^cms-l-cn-/.test(x)) : []; });
  ok("ROLE: урок раздела пройден у «Новичка» — номер с треком (cms-l-cn-seasonal-…)", keys.length === 1 && /^cms-l-cn-seasonal-/.test(keys[0]), JSON.stringify(keys));
  await toTrack(page, "seasonal"); await toConceptPage(page);
  const after = await curMenu(page);
  ok("ROLE: у «Новичка» дальше — следующий урок раздела", !!before && !!after && before.next !== after.next, JSON.stringify({ b: before && before.next, a: after && after.next }));
  await toTrack(page, "spg"); await toConceptPage(page);
  const spg = await curMenu(page);
  ok("ROLE: у «Хостес» тот же урок не пройден — начинать с первого", !!spg && !!before && spg.next === before.next, JSON.stringify({ spg: spg && spg.next, b: before && before.next }));
  await shot(page, "role-spg");
  await toTrack(page, "seasonal"); await toConceptPage(page);
  const back = await curMenu(page);
  ok("ROLE: снова «Новичок» — пройденное на месте", !!back && back.next === after.next);
  ok("ROLE: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ DOC ═══════════════════════════════════════════════════════════════════════════════════
if (want("DOC")) {
  const { ctx, page, errs } = await open({ cn: "fail-dress" });
  await editor(page);
  const n0 = await page.locator("[data-cn-row]").count();
  await page.locator("[data-cn-doc]").click(); await page.waitForTimeout(500);
  const src = await txt(page.locator("[data-cn-docbox]"));
  ok("DOC: «Из документа» — PDF, Word или текст; «Куда» — вся сеть или заведение; вопросы для теста включены", /PDF, Word или текст/.test(src)
    && (await page.locator("[data-cn-docwhere]").count()) === 1 && (await page.locator("[data-cn-docq]").isChecked()));
  const miss0 = await lensMiss(page);
  ok("DOC: «Линза» — поле, «Прикрепить файл», «Разобрать», «Отмена»", !miss0.length, JSON.stringify(miss0));
  // Word: текст — в поле
  await page.locator("[data-cn-docfile] input[type=file]").setInputFiles({ name: "concept.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: DOCX });
  ok("DOC: Word (.docx) — текст в поле (заголовок звёздочками), подсказка", !!(await until(async () => /\*\*Marin Resto Group\*\*/.test(await page.locator("[data-cn-doctext]").inputValue())))
    && /Текст из «concept\.docx» в поле выше/.test(await txt(page.locator("[data-cn-docnote]"))));
  // PDF больше 3 МБ — отказ
  await page.locator("[data-cn-docfile] input[type=file]").setInputFiles({ name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(3 * 1024 * 1024 + 10, 32) });
  ok("DOC: PDF больше 3 МБ — «сервер такой не примет»", !!(await until(async () => /PDF больше 3 МБ: сервер такой не примет/.test(await txt(page.locator("[data-cn-docerr]"))))));
  await page.locator("[data-cn-doctext]").fill(DOC);
  await shot(page, "doc-src");
  await page.locator("[data-cn-docrun]").click();
  ok("DOC: сначала «Читаю документ и составляю план блоков…»", !!(await until(() => page.locator('[data-cn-docstep="plan"]').count(), 3000)));
  ok("DOC: блоки пишутся — строки «пишу…»/«готово»", !!(await until(() => page.locator('[data-cn-docbox="write"] [data-cn-docstatus]').count(), 5000)));
  ok("DOC: в конце — просмотр перед сохранением", !!(await until(() => page.locator('[data-cn-docbox="review"]').count(), 20000)));
  const st = await page.evaluate(() => [...document.querySelectorAll("[data-cn-docblock]")].map((b) => b.getAttribute("data-cn-docblock") + ":" + b.getAttribute("data-cn-docstatus")));
  ok("DOC: план — концепция, ценности, форма; форма не написалась — «не вышло», «Повторить»", st.join(",") === "idea:ok,values:ok,dress:fail"
    && (await page.locator('[data-cn-docblock="dress"] [data-cn-docretry]').count()) === 1, JSON.stringify(st));
  await page.evaluate(() => sessionStorage.removeItem("__e2e_cn"));
  await page.locator('[data-cn-docblock="dress"] [data-cn-docretry]').click();
  ok("DOC: «Повторить» — форма готова", !!(await until(() => page.locator('[data-cn-docblock="dress"][data-cn-docstatus="ok"]').count(), 6000)));
  ok("DOC: у каждого блока — вопросы для теста", /2 вопроса для теста/.test(await txt(page.locator('[data-cn-docblock="idea"]'))));
  ok("DOC: есть такой же блок — «Заменить» / «Добавить», выбрано «Заменить», сказано, что останется", (await page.locator('[data-cn-docblock="idea"] [data-cn-docmode="replace"]').count()) === 1
    && /Заменит прежний «.+»: текст станет новым, фото и «для кого» останутся/.test(await txt(page.locator('[data-cn-docblock="idea"]'))));
  await page.locator('[data-cn-docblock="idea"] [data-cn-docpeek]').click(); await page.waitForTimeout(400);
  const look = await page.evaluate(() => { const l = document.querySelector('[data-cn-docblock="idea"] [data-lesson-look]'); if (!l) return null;
    return { lead: !!l.querySelector('[data-look="lead"]'), head: !!l.querySelector('[data-look="head"]'), dot: !!l.querySelector('[data-look="dot"]'), pin: !!l.querySelector('[data-look="pin"]') }; });
  ok("DOC: «Как в уроке» — первая мысль крупно, часть, пункты, вывод", !!look && look.lead && look.head && look.dot && look.pin, JSON.stringify(look));
  await page.locator("[data-cn-docbox]").scrollIntoViewIfNeeded();
  await shot(page, "doc-review");
  // ценности — новым блоком, концепцию — заменить, форму не брать
  await page.locator('[data-cn-docblock="values"] [data-cn-docmode] [data-seg="add"]').click().catch(() => {});
  await page.locator('[data-cn-docblock="dress"] input[type=checkbox]').uncheck();
  await page.locator('[data-cn-docblock="idea"] [data-cn-doctitle]').fill("Кто мы: Marin Resto Group");
  const miss1 = await lensMiss(page);
  ok("DOC: «Линза» — просмотр (заголовки, «Сохранить»)", !miss1.length, JSON.stringify(miss1));
  ok("DOC: кнопка — «Сохранить 2 блока»", /Сохранить 2 блока/.test(await txt(page.locator("[data-cn-docadd]"))));
  await page.locator("[data-cn-docadd]").click();
  const msg = await until(async () => { const t = await txt(page.locator("[data-cn-msg]")); return /Готово:/.test(t) ? t : null; }, 8000);
  ok("DOC: сохранено — сообщение, сколько добавлено и обновлено", !!msg && /обновлено 1/.test(msg), msg);
  const rows = await page.evaluate(() => [...document.querySelectorAll("[data-cn-row]")].map((r) => r.getAttribute("data-cn-row") + ":" + (r.querySelector("[data-cn-lead]") || { textContent: "" }).textContent.slice(0, 30)));
  ok("DOC: в списке — «Кто мы: Marin Resto Group» вместо прежней концепции, ценности добавлены, форма — нет", /Кто мы: Marin Resto Group/.test(await body(page))
    && rows.filter((r) => r.startsWith("idea:")).length === 1 && rows.length === n0 + (rows.some((r) => r.startsWith("values:")) ? 1 : 0) - 0, JSON.stringify(rows));
  ok("DOC: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ BLOCK ═══════════════════════════════════════════════════════════════════════════════════
if (want("BLOCK")) {
  const { ctx, page, errs } = await open();
  await editor(page);
  await page.locator('[data-cn-open="idea"]').first().click(); await page.waitForTimeout(700);
  const miss0 = await lensMiss(page);
  ok("BLOCK: кнопки разметки уроков (Шаги, Как надо, Нельзя, Вывод, Фраза гостю) и «Оформить как урок»; «Линза»", (await page.locator("[data-cn-mk]").count()) === 5
    && /Оформить как урок/.test(await txt(page.locator("[data-cn-improve]"))) && !miss0.length, JSON.stringify(miss0));
  ok("BLOCK: под текстом — сколько слов и карточек", /\d+ сл\S* · \d+ карточ/.test(await txt(page.locator("[data-cn-info]"))));
  await page.locator('[data-cn-view] [data-seg="look"]').click(); await page.waitForTimeout(400);
  ok("BLOCK: «Как в уроке» — текст видом урока (первая мысль крупно)", (await page.locator('[data-cn-look] [data-look="lead"]').count()) === 1);
  await shot(page, "block-look");
  await page.locator('[data-cn-view] [data-seg="text"]').click(); await page.waitForTimeout(300);
  await page.locator("[data-cn-body]").fill("Как встречаем гостя.\n\nУлыбка\nПриветствие\nПроводить к столу");
  await page.locator("[data-cn-body]").evaluate((t) => { const v = t.value, s = v.indexOf("Улыбка"); t.focus(); t.setSelectionRange(s, v.length); });
  await page.locator('[data-cn-mk="steps"]').click(); await page.waitForTimeout(300);
  ok("BLOCK: «Шаги» — выделенные строки 1️⃣ 2️⃣ 3️⃣", (await page.locator("[data-cn-body]").inputValue()) === "Как встречаем гостя.\n\n1️⃣ Улыбка\n2️⃣ Приветствие\n3️⃣ Проводить к столу");
  await page.locator("[data-cn-body]").fill("Наша идея простая: кормить гостей так, как кормили бы своих близких. Начинали с одного зала у порта. Сегодня семь ресторанов на Камчатке. Гостя замечаем раньше, чем он попросит.");
  const was = await page.locator("[data-cn-body]").inputValue();
  await page.locator("[data-cn-improve]").click();
  ok("BLOCK: «Оформить как урок» — текст видом уроков, сразу «Как в уроке», есть «Вернуть как было»", !!(await until(() => page.locator('[data-cn-look] [data-look="head"]').count(), 6000))
    && (await page.locator("[data-cn-undo]").count()) === 1);
  await page.locator("[data-cn-undo]").click(); await page.waitForTimeout(300);
  await page.locator('[data-cn-view] [data-seg="text"]').click().catch(() => {}); await page.waitForTimeout(300);
  ok("BLOCK: «Вернуть как было» — прежний текст", (await page.locator("[data-cn-body]").inputValue()) === was);
  await page.locator("[data-cn-body]").fill("## Кто мы\n- семь ресторанов\n- Камчатка\nВажно: гость первым.");
  await page.locator("[data-cn-save]").click();
  ok("BLOCK: сохранено — в списке первая мысль строки — из разметки уроков", !!(await until(() => page.locator('[data-cn-row="idea"]').count(), 5000)));
  const saved = await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem("__demo_srv") || "{}"); const b = ((s.cn || {}).blocks || []).find((x) => x.kind === "idea" && x.scope === ""); return b ? b.body : null; } catch (e) { return null; } });
  ok("BLOCK: в базе — разметка уроков («**Кто мы**», «• », «📌»)", saved === "**Кто мы**\n• семь ресторанов\n• Камчатка\n\n📌 Важно: гость первым.", JSON.stringify(saved));
  ok("BLOCK: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ RESTYLE ═══════════════════════════════════════════════════════════════════════════════════
if (want("RESTYLE")) {
  for (const flag of ["", "nostyle"]) {
    const tag = "RESTYLE" + (flag ? " (помощник молчит)" : "");
    const { ctx, page, errs } = await open({ cn: flag });
    await editor(page);
    await page.locator("[data-cn-restyle-go]").click();
    ok(tag + ": сначала работа, потом «Было / Стало»", !!(await until(() => page.locator('[data-cn-restyle="review"]').count(), 15000)));
    const st = await page.evaluate(() => [...document.querySelectorAll("[data-cn-rsblock]")].map((b) => b.getAttribute("data-cn-rsstatus")));
    ok(tag + ": каждый блок — готово или коротко", st.length >= 2 && st.every((s) => s === "ok" || s === "skip"), JSON.stringify(st));
    if (!flag) {
      ok(tag + ": «Было / Стало», выбрано «Стало», просмотр как в уроке", (await page.locator('[data-cn-rsview="new"]').count()) >= 1 && (await page.locator("[data-cn-rsblock] [data-lesson-look]").count()) >= 1);
      const a = await txt(page.locator("[data-cn-rsblock] [data-lesson-look]").first());
      await page.locator('[data-cn-rsview] [data-seg="old"]').first().click(); await page.waitForTimeout(300);
      const b = await txt(page.locator("[data-cn-rsblock] [data-lesson-look]").first());
      ok(tag + ": «Было» — прежний текст, другой", a !== b);
      const miss = await lensMiss(page);
      ok(tag + ": «Линза»", !miss.length, JSON.stringify(miss));
      await shot(page, "restyle");
      await page.locator("[data-cn-rssave]").click();
      const msg = await until(async () => { const t = await txt(page.locator("[data-cn-msg]")); return /Оформлено как в уроках: \d+/.test(t) ? t : null; }, 8000);
      ok(tag + ": сохранено — «Оформлено как в уроках: N блоков»", !!msg, msg);
    } else {
      const t = await txt(page.locator("[data-cn-restyle]"));
      ok(tag + ": «помощник не ответил» — только разметка или как есть", /помощник не ответил/.test(t), t.slice(0, 300));
    }
    ok(tag + ": без ошибок", !errs.length, errs.join(" | "));
    await ctx.close();
  }
}

// ═══ NO57 ═══════════════════════════════════════════════════════════════════════════════════
if (want("NO57")) {
  const { ctx, page, errs } = await open({ no57: true });
  await editor(page);
  const card = await txt(page.locator("[data-cn-section]"));
  ok("NO57: название по умолчанию, вместо переключателя — «Для ознакомления» текстом", /Наш ресторан/.test(card) && (await page.locator("[data-cn-mode]").count()) === 0 && /Для ознакомления/.test(card), card);
  await page.locator("[data-cn-secedit]").click(); await page.waitForTimeout(300);
  ok("NO57: «Переименовать» — про этап 57", /этап 57: supabase-stage57-concept-title\.sql/.test(await txt(page.locator("[data-cn-secneed]"))));
  await toTrack(page, "seasonal"); await toConceptPage(page);
  const m = await curMenu(page);
  ok("NO57: в треке — «Наш ресторан», для ознакомления", !!m && m.title === "Наш ресторан" && m.info, JSON.stringify(m));
  ok("NO57: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ LOOK ═══════════════════════════════════════════════════════════════════════════════════
if (want("LOOK")) {
  for (const [w, light] of [[320, false], [390, true]]) {
    const tag = "LOOK " + w + (light ? " «Для чтения»" : "");
    const { ctx, page, errs } = await open({ width: w, light });
    await editor(page);
    ok(tag + ": правка — без прокрутки вбок", (await overflowX(page)) <= 0);
    await shot(page, "look-edit-" + w + (light ? "-light" : ""));
    await page.locator("[data-cn-doc]").click(); await page.waitForTimeout(400);
    await page.locator("[data-cn-doctext]").fill(DOC);
    await page.locator("[data-cn-docrun]").click();
    await until(() => page.locator('[data-cn-docbox="review"]').count(), 20000);
    await page.locator("[data-cn-docpeek]").first().click(); await page.waitForTimeout(400);
    ok(tag + ": «Из документа» и «как в уроке» — без прокрутки вбок", (await overflowX(page)) <= 0);
    await page.locator("[data-cn-docbox]").scrollIntoViewIfNeeded();
    await shot(page, "look-doc-" + w + (light ? "-light" : ""));
    ok(tag + ": без ошибок", !errs.length, errs.join(" | "));
    await ctx.close();
  }
}

console.log("\nитог: " + pass + " ✓, " + fail + " ✗");
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
