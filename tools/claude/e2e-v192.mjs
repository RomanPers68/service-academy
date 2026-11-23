// e2e v192 (Доп. 517): «О нас» — все семь идей владельца («Делаем все 7»). Сайт — демо целиком (tools/claude/demo-app/build.mjs:
// сервер в странице, демо-помощник без модели; localStorage.__demo_no58 = "1" — сервер без этапа 58; sessionStorage.__e2e_pitch =
// "fail" — помощник тренажёра не отвечает).
// Разделы:
//   ABOUT     — обложка (фото зала, название, заведение, «прочитай и отметь»), оглавление (касание — к блоку), внизу
//               «Прочитала раздел?» и «Ознакомлена» → «Ознакомлена <дата>», на сервере дата; раздел целиком в PDF;
//   CHANGES   — руководитель поправил, добавил, убрал блок: на обложке «Изменилось: 3», «Что изменилось» (изменён, новый,
//               убрали), касание — к блоку и сразу что поменялось (новые слова, новые строки), «Как сейчас»; отметила снова —
//               пометки ушли;
//   SHEET     — руководитель: «Кто ознакомлен» — дата у Анны, «(ты)» у себя, «Ещё нет»; лист ознакомления и раздел — PDF;
//   HISTORY   — история блока: версия с датой и автором, сравнение, «Вернуть эту версию»; удалённый блок — «Вернуть»;
//   PITCH     — тренажёр: вопрос гостя, 30 секунд, поле и микрофон, пусто — просьба, разбор (оценка, получилось, упущено,
//               совет, как могло звучать), образец после попытки, «Ещё раз», «назад» — в «О нас»; помощник молчит — разбор по образцу;
//   FOOT      — внизу раздела в треке: «Ознакомлена» ждёт уроков, «прочитай одной страницей», тренажёр; после отметки — дата;
//   ACKLESSON — уроки раздела пройдены — «Ознакомлена» прямо в треке;
//   NEWBIE    — новичку в первый день «Знакомство с компанией»: ведёт в раздел, после отметки отмечен сам, на сервере тоже;
//   WORD      — Word с картинками: метки «[фото N]», рисунок Office пропущен, помощник раскладывает фото по блокам, подпись из
//               Word, «Не брать», сохранено — фото в блоке, меток в тексте нет;
//   NO58      — сервер без этапа 58: отметка без даты, истории нет — понятная надпись;
//   LOOK      — 320 px и «Для чтения»: «О нас», отметка, тренажёр — без прокрутки вбок; снимки.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v192.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { deflateRawSync } from "node:zlib";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5792, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v192";
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
async function open({ who = "roman", light = false, width = 390, height = 844, no57 = false, no58 = false, cn = "", pitch = "" } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n, f, n8, pf]) => { localStorage.clear(); localStorage.setItem("__demo_who", w); if (n) localStorage.setItem("__demo_no57", "1"); if (n8) localStorage.setItem("__demo_no58", "1");
    if (f) sessionStorage.setItem("__e2e_cn", f); if (pf) sessionStorage.setItem("__e2e_pitch", pf); }, [who, no57, cn, no58, pitch]);
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
  .filter((e) => !e.closest("[data-cn-photo]") && !e.closest("[data-lesson-look]") && !e.matches("[data-cn-right], [data-lens-seg] > button, [data-cn-docpeek], [data-cn-other] .sa-hit"))
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

// ── v192: помощники ─────────────────────────────────────────────────────────────────────────────
const srvCall = (page, fn, who, body = {}) => page.evaluate(([f, w, b]) => { const r = window.__demo.srv.rpc(f, { p_token: "demo-" + w, ...b }); window.__demo.save(); return r; }, [fn, who, body]);
const asWho = async (page, who) => { await page.evaluate((w) => localStorage.setItem("__demo_who", w), who); await page.reload({ waitUntil: "load" }); await ready(page, []); };
const about = async (page) => { await nav(page, "about", 2200); await page.waitForSelector('[data-about="ready"]', { timeout: 8000 }).catch(() => {}); };
const inView = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight * 0.6; }, sel);
const lastPdf = (page) => page.evaluate(() => window.__saLastPdf || null);
// .docx с картинками (без сжатия): document.xml, связи, файлы картинок
function docxPics(xml, rels, media) {
  const files = [["[Content_Types].xml", Buffer.from("<Types/>")], ["word/document.xml", Buffer.from(xml)], ["word/_rels/document.xml.rels", Buffer.from(rels)], ...media];
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const parts = [], dir = []; let off = 0;
  for (const [name, data] of files) {
    const nb = Buffer.from(name, "utf8"), c = crc(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(c, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt32LE(c, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nb, data); dir.push(Buffer.concat([ch, nb])); off += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(dir), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
const PIC = (rid, descr) => `<w:r><w:drawing><wp:inline><wp:docPr id="1" name="Picture 1" descr="${descr}"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
const W = (t, st = "", extra = "") => `<w:p>${st ? `<w:pPr><w:pStyle w:val="${st}"/></w:pPr>` : ""}${t ? `<w:r><w:t>${t}</w:t></w:r>` : ""}${extra}</w:p>`;

// ═══ ABOUT: обложка, оглавление, «Ознакомлен(а)» ════════════════════════════════════════════════
if (want("ABOUT")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await about(page);
  const cover = page.locator("[data-cn-cover]");
  ok("ABOUT: обложка — фото зала, название раздела и заведение", (await cover.getAttribute("data-cn-cover")) === "photo" && /Наш ресторан/.test(await txt(cover)) && /Два моря, Океан/.test(await txt(cover)), await txt(cover));
  ok("ABOUT: на обложке — «Прочитай и отметь внизу «Ознакомлена»»", (await page.locator('[data-cn-status="new"]').count()) === 1 && /Ознакомлена/.test(await txt(page.locator("[data-cn-status]"))), await txt(page.locator("[data-cn-status]")));
  const toc = await page.locator("[data-cn-toc]").count(), blocks = await page.locator("[data-cn-block]").count();
  ok("ABOUT: оглавление — по кнопке на каждый блок (" + blocks + ")", toc === blocks && toc >= 6, toc + " / " + blocks);
  await page.waitForTimeout(800);
  await shot(page, "about-cover");
  const last = await page.locator("[data-cn-toc]").last().getAttribute("data-cn-toc");
  await page.locator("[data-cn-toc]").last().click(); await page.waitForTimeout(1100);
  ok("ABOUT: касание оглавления — экран у этого блока", await inView(page, '[data-cn-id="' + last + '"]'));
  const miss = await lensMiss(page);
  ok("ABOUT: у кнопок обложки и отметки — метки «Линзы»", !miss.length, JSON.stringify(miss));
  await bottom(page);
  ok("ABOUT: внизу — «Прочитала раздел?» и «Ознакомлена»", (await page.locator('[data-cn-ack="need"]').count()) === 1 && (await txt(page.locator("[data-cn-read]"))) === "Ознакомлена");
  await shot(page, "about-ack-need");
  await page.locator("[data-cn-read]").click();
  ok("ABOUT: отметила — «Ознакомлена <дата>», кнопки нет", !!(await until(() => page.locator("[data-cn-readok]").count(), 5000)) && /^Ознакомлена \d{1,2} [а-я]+ \d{4}/.test(await txt(page.locator("[data-cn-readok]"))) && !(await page.locator("[data-cn-read]").count()),
    await txt(page.locator("[data-cn-ack]")));
  const g = await srvCall(page, "concept_get", "e-anna");
  ok("ABOUT: на сервере — обе части с датой отметки", g.read.net === g.net.ver && g.read.venue === g.venue.ver && !!g.read_at.net && !!g.read_at.venue, JSON.stringify(g.read_at));
  await shot(page, "about-ack-ok");
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await page.waitForTimeout(300);
  ok("ABOUT: обложка — «Ознакомлена <дата>»", (await page.locator('[data-cn-status="ok"]').count()) === 1, await txt(page.locator("[data-cn-status]")));
  // раздел целиком в PDF (в браузере — файл с телефона)
  await bottom(page);
  await page.locator("[data-cn-print]").click();
  const pdf = await until(() => lastPdf(page), 15000);
  ok("ABOUT: «Раздел целиком в PDF» — файл «О нас, Два моря, Океан.pdf»", !!pdf && pdf.kind === "concept_pdf" && pdf.size > 20000 && /О нас, Два моря, Океан\.pdf/.test(pdf.name), JSON.stringify(pdf));
  ok("ABOUT: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ CHANGES: что изменилось после отметки ═════════════════════════════════════════════════════
if (want("CHANGES")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await about(page); await bottom(page);
  await page.locator("[data-cn-read]").click(); await until(() => page.locator("[data-cn-readok]").count(), 5000);
  // руководитель правит «Сервировку», добавляет блок и убирает «Правильный чек»
  const g = await srvCall(page, "concept_get", "u-maria");
  const set = g.venue.blocks.find((b) => b.kind === "setting"), chk = g.venue.blocks.find((b) => b.kind === "check");
  await page.waitForTimeout(30);
  const r1 = await srvCall(page, "concept_save", "u-maria", { p_block: { ...set, body: set.body.replace("Салфетка на тарелке", "Льняная салфетка на тарелке") + "\n• Свеча на каждом столе после 18:00" } });
  const r2 = await srvCall(page, "concept_save", "u-maria", { p_block: { scope: g.venue.name, kind: "own", title: "Музыка в зале", body: "Днём — тихий джаз, вечером — живая гитара по пятницам." } });
  const r3 = await srvCall(page, "concept_delete", "u-maria", { p_id: chk.id });
  ok("CHANGES: руководитель поправил, добавил и убрал блок (сервер)", r1.ok && r2.ok && r3.ok, JSON.stringify([r1.error, r2.error, r3.error]));
  await asWho(page, "anna");
  await about(page);
  ok("CHANGES: обложка — «Изменилось после твоей отметки: 3»", (await page.locator('[data-cn-status="changed"]').count()) === 1 && /: 3\./.test(await txt(page.locator("[data-cn-status]"))), await txt(page.locator("[data-cn-status]")));
  const card = page.locator("[data-cn-changes]");
  const kinds = await page.locator("[data-cn-chg]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cn-chg")).join(","));
  ok("CHANGES: «Что изменилось» — изменён, новый, убрали", (await card.count()) === 1 && kinds === "edit,new,gone" && /Сервировка залов/.test(await txt(card)) && /Музыка в зале/.test(await txt(card)) && /Правильный чек/.test(await txt(card)), kinds + " " + (await txt(card)));
  await shot(page, "changes-card");
  ok("CHANGES: у блоков — «изменён» и «новый»", (await page.locator('[data-cn-badge="edit"]').count()) === 1 && (await page.locator('[data-cn-badge="new"]').count()) === 1);
  await page.locator('[data-cn-chg="edit"]').click(); await page.waitForTimeout(1100);
  const diff = page.locator("[data-cn-diff]");
  ok("CHANGES: касание — к блоку, сразу видно, что поменялось", await inView(page, '[data-cn-id="' + set.id + '"]') && (await diff.count()) === 1 && (await page.locator("[data-cn-diff-add]").count()) >= 1 && (await page.locator("[data-cn-diff-mod] ins").count()) >= 1,
    await diff.getAttribute("data-cn-diff").catch(() => "нет"));
  ok("CHANGES: новые слова подчёркнуты, новая строка — зелёным, без изменений — свёрнуто", /Льняная/.test(await txt(page.locator("[data-cn-diff-mod] ins").first())) && /Свеча на каждом столе/.test(await txt(page.locator("[data-cn-diff-add]").first()))
    && (await page.locator("[data-cn-diff-fold]").count()) >= 1, await txt(diff));
  await shot(page, "changes-diff");
  await page.locator("[data-cn-difftoggle]").click(); await page.waitForTimeout(400);
  ok("CHANGES: «Как сейчас» — обычный текст блока", !(await page.locator("[data-cn-diff]").count()) && (await txt(page.locator("[data-cn-difftoggle]"))) === "Что поменялось");
  const miss = await lensMiss(page);
  ok("CHANGES: метки «Линзы» на месте", !miss.length, JSON.stringify(miss));
  await bottom(page);
  await page.locator("[data-cn-read]").click(); await until(() => page.locator("[data-cn-readok]").count(), 5000);
  ok("CHANGES: отметила снова — «Что изменилось» и пометки ушли", !(await page.locator("[data-cn-changes]").count()) && !(await page.locator("[data-cn-badge]").count()));
  ok("CHANGES: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ SHEET: лист ознакомления у руководителя ═════════════════════════════════════════════════════
if (want("SHEET")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await about(page); await bottom(page);
  await page.locator("[data-cn-read]").click(); await until(() => page.locator("[data-cn-readok]").count(), 5000);
  await asWho(page, "maria");
  await editor(page);
  await page.locator('[data-cn-tab="venue"]').click(); await page.waitForTimeout(700);
  await bottom(page);
  await page.locator("[data-cn-reads]").click(); await page.waitForTimeout(900);
  const list = page.locator("[data-cn-readlist]");
  const rl = await list.getAttribute("data-cn-readlist");
  ok("SHEET: «Ознакомлены 1 из N» — Анна, остальные ещё нет", /^1\/\d+$/.test(rl || "") && /Ещё нет:/.test(await txt(list)), rl);
  const anna = page.locator('[data-cn-ackrow="ok"]');
  ok("SHEET: у Анны — дата отметки, у себя — «(ты)»", (await anna.count()) === 1 && /Анна Смирнова/.test(await txt(anna)) && /\d\d\.\d\d\.\d{4}/.test(await txt(anna)) && /\(ты\)/.test(await txt(list)), await txt(anna));
  await shot(page, "sheet-list");
  await page.locator("[data-cn-sheet]").click();
  const pdf = await until(() => lastPdf(page), 10000);
  ok("SHEET: «Лист ознакомления, PDF» — файл для отдела кадров", !!pdf && pdf.kind === "concept_acks_pdf" && /^Лист ознакомления, Два моря, Океан\.pdf$/.test(pdf.name) && pdf.size > 3000, JSON.stringify(pdf));
  await page.evaluate(() => { window.__saLastPdf = null; });
  await page.locator("[data-cn-printall]").click();
  const pdf2 = await until(() => lastPdf(page), 15000);
  ok("SHEET: «Раздел в PDF» — всё, что есть в разделе", !!pdf2 && pdf2.kind === "concept_pdf" && pdf2.size > 20000, JSON.stringify(pdf2));
  ok("SHEET: сообщение под кнопками", /Файл сохранён/.test(await txt(page.locator("[data-cn-pdfmsg]"))));
  const miss = await lensMiss(page);
  ok("SHEET: метки «Линзы» на месте", !miss.length, JSON.stringify(miss));
  ok("SHEET: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ HISTORY: версии блока и «Вернуть»; удалённые блоки ════════════════════════════════════════
if (want("HISTORY")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  const g = await srvCall(page, "concept_get", "u-maria");
  const set = g.venue.blocks.find((b) => b.kind === "setting"), chk = g.venue.blocks.find((b) => b.kind === "check");
  await srvCall(page, "concept_save", "u-maria", { p_block: { ...set, body: "Новый текст сервировки: только тарелка и приборы." } });
  await srvCall(page, "concept_delete", "u-maria", { p_id: chk.id });
  await asWho(page, "maria");
  await editor(page);
  await page.locator('[data-cn-tab="venue"]').click(); await page.waitForTimeout(700);
  ok("HISTORY: «Удалённые блоки» — «Правильный чек» с «Вернуть»", (await page.locator("[data-cn-gone]").count()) === 1 && /Правильный чек/.test(await txt(page.locator("[data-cn-gone]"))));
  await page.locator('[data-cn-open="setting"]').click(); await page.waitForTimeout(900);
  await page.locator("[data-cn-hist]").click(); await page.waitForTimeout(900);
  const vers = page.locator("[data-cn-ver]");
  ok("HISTORY: история блока — прежняя версия с датой и автором", (await page.locator('[data-cn-history="ready"]').count()) === 1 && (await vers.count()) === 1 && /Версия от \d+ [а-я]+ \d{4}, Мария Ким/.test(await txt(vers.first())), await txt(page.locator("[data-cn-history]")));
  await vers.first().locator("button").first().click(); await page.waitForTimeout(500);
  ok("HISTORY: «Что было» — сравнение с нынешним", (await page.locator("[data-cn-history] [data-cn-diff]").count()) === 1 && (await page.locator("[data-cn-history] del, [data-cn-history] [data-cn-diff-del]").count()) >= 1);
  await shot(page, "history-open");
  const miss = await lensMiss(page);
  ok("HISTORY: метки «Линзы» на месте", !miss.length, JSON.stringify(miss));
  await page.locator("[data-cn-revert]").click();
  ok("HISTORY: «Вернуть эту версию» — снова прежний текст, сообщение", !!(await until(() => page.locator('[data-about="edit"]').count(), 5000)) && /Вернул версию от/.test(await txt(page.locator("[data-cn-msg]"))), await txt(page.locator("[data-cn-msg]").first()));
  const g2 = await srvCall(page, "concept_get", "u-maria");
  ok("HISTORY: на сервере — прежний текст, нынешний — в истории", g2.venue.blocks.find((b) => b.id === set.id).body === set.body
    && (await srvCall(page, "concept_history", "u-maria", { p_id: set.id })).versions.length === 2);
  await page.waitForTimeout(800);
  await page.locator("[data-cn-restore]").scrollIntoViewIfNeeded();
  await page.locator("[data-cn-restore]").click();
  const back = !!(await until(async () => (await srvCall(page, "concept_get", "u-maria")).venue.blocks.some((b) => b.id === chk.id), 5000));
  const gone0 = await until(async () => !(await page.locator("[data-cn-gone]").count()) && /снова на месте/.test(await txt(page.locator("[data-cn-msg]"))), 5000);
  ok("HISTORY: удалённый блок вернулся (тот же номер), список удалённых пуст", back && !!gone0,
    back + " | " + (await txt(page.locator("[data-cn-gone]")).catch(() => "")) + " | " + (await txt(page.locator("[data-cn-msg]")).catch(() => "")));
  ok("HISTORY: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ PITCH: «Рассказ гостю за 30 секунд» ═══════════════════════════════════════════════════════
if (want("PITCH")) {
  for (const fail0 of [false, true]) {
    const { ctx, page, errs } = await open({ who: "anna", pitch: fail0 ? "fail" : "" });
    const tag = fail0 ? "PITCH (помощник молчит)" : "PITCH";
    await about(page);
    await page.locator("[data-cn-pitch]").scrollIntoViewIfNeeded();
    await page.locator("[data-cn-pitch]").click(); await page.waitForTimeout(1500);
    ok(tag + ": экран тренажёра — вопрос гостя и «Начать»", (await page.locator('[data-pitch="intro"]').count()) === 1 && /Что у вас за место/.test(await body(page)));
    if (!fail0) await shot(page, "pitch-intro");
    await page.locator("[data-pitch-start]").click(); await page.waitForTimeout(1300);
    const ring = await page.locator("[data-pitch-ring]").getAttribute("data-pitch-ring");
    ok(tag + ": идёт время — кольцо 30 секунд, поле и микрофон", (await page.locator('[data-pitch="talk"]').count()) === 1 && Number(ring) <= 29 && Number(ring) >= 25 && (await page.locator("[data-pitch-text]").count()) === 1, ring);
    await page.locator("[data-pitch-done]").click(); await page.waitForTimeout(300);
    ok(tag + ": пусто — просит рассказать пару предложений", /пару предложений/.test(await txt(page.locator("[data-pitch-msg]"))));
    await page.locator("[data-pitch-text]").fill("Добрый вечер! Мы ресторан у моря, у нас рыба и морепродукты с утреннего улова, шеф готовит на открытом огне. Обязательно попробуйте что-нибудь с гриля.");
    ok(tag + ": счёт слов под полем", /^2\d|^\d\d/.test(await page.locator("[data-pitch-words]").getAttribute("data-pitch-words")));
    if (!fail0) await shot(page, "pitch-talk");
    await page.locator("[data-pitch-done]").click();
    await until(() => page.locator('[data-pitch="result"]').count(), 6000);
    const score = Number(await page.locator("[data-pitch-score]").getAttribute("data-pitch-score"));
    ok(tag + ": разбор — оценка, что получилось, совет", score >= 1 && score <= 5 && (await page.locator("[data-pitch-tip]").count()) === 1 && ((await page.locator("[data-pitch-good]").count()) + (await page.locator("[data-pitch-missed]").count())) >= 1, String(score));
    ok(tag + (fail0 ? ": помощник молчит — разбор по образцу, «как могло звучать» нет" : ": «Как могло звучать» — мысли образца"),
      fail0 ? (await page.locator("[data-pitch-better]").count()) === 0 && /разбор по словам образца/.test(await body(page)) : (await page.locator("[data-pitch-better]").count()) === 1);
    await page.locator("[data-pitch-peek]").click(); await page.waitForTimeout(300);
    ok(tag + ": образец открывается после попытки", (await page.locator("[data-pitch-ref]").count()) === 1 && /«|Мы|мы/.test(await txt(page.locator("[data-pitch-ref]"))));
    const miss = await lensMiss(page);
    ok(tag + ": метки «Линзы» на месте", !miss.length, JSON.stringify(miss));
    if (!fail0) { await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await shot(page, "pitch-result"); }
    await page.locator("[data-pitch-again]").click(); await page.waitForTimeout(500);
    ok(tag + ": «Ещё раз» — снова время и пустое поле", (await page.locator('[data-pitch="talk"]').count()) === 1 && !(await page.locator("[data-pitch-text]").inputValue()));
    await page.locator('[data-lens="back"]').first().click(); await page.waitForTimeout(1200);
    ok(tag + ": «назад» — в «О нас»", (await screenName(page)) === "about", (await screenName(page)) + " " + JSON.stringify(await page.evaluate(() => (window.__saStack ? window.__saStack() : null))));
    ok(tag + ": без ошибок", !errs.length, errs.join(" | "));
    await ctx.close();
  }
}

// ═══ FOOT: внизу раздела в треке — «Ознакомлен(а)» и рассказ гостю ══════════════════════════════════
if (want("FOOT")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await toTrack(page, "seasonal"); await toConceptPage(page);
  const foot = page.locator(".tbp-cur [data-cn-foot]");
  ok("FOOT: внизу раздела — «Ознакомлена» ждёт уроков и тренажёр", (await foot.getAttribute("data-cn-foot")) === "need" && (await page.locator('.tbp-cur [data-cn-footack="wait"]').count()) === 1
    && (await page.locator(".tbp-cur [data-cn-footack]").isDisabled()) && (await page.locator(".tbp-cur [data-cn-footpitch]").count()) === 1, await txt(foot));
  await page.locator(".tbp-cur [data-cn-foot]").scrollIntoViewIfNeeded();
  await shot(page, "foot-need");
  // уроки раздела пройдены — отметка доступна
  await page.evaluate(() => {
    const g = window.__demo.srv.rpc("concept_get", { p_token: "demo-e-anna" });
    return g;
  });
  await page.locator(".tbp-cur [data-cn-footall]").click(); await page.waitForTimeout(1600);
  ok("FOOT: «Или прочитай весь раздел одной страницей» — «О нас»", (await screenName(page)) === "about");
  await page.locator('[data-lens="back"]').first().click(); await page.waitForTimeout(1400);
  await page.locator(".tbp-cur [data-cn-footpitch]").click(); await page.waitForTimeout(1500);
  ok("FOOT: «Рассказ гостю» — тренажёр", (await page.locator('[data-pitch="intro"]').count()) === 1);
  await page.locator('[data-lens="back"]').first().click(); await page.waitForTimeout(1400);
  // отметка из «О нас» — внизу раздела «Ознакомлена <дата>»
  await about(page); await bottom(page); await page.locator("[data-cn-read]").click(); await until(() => page.locator("[data-cn-readok]").count(), 5000);
  await toTrack(page, "seasonal"); await toConceptPage(page);
  ok("FOOT: отметка стоит — «Ознакомлена» и дата", (await page.locator(".tbp-cur [data-cn-foot]").getAttribute("data-cn-foot")) === "ok" && /Ознакомлена/.test(await txt(page.locator(".tbp-cur [data-cn-footok]"))), await txt(page.locator(".tbp-cur [data-cn-foot]")));
  await page.locator(".tbp-cur [data-cn-foot]").scrollIntoViewIfNeeded();
  await shot(page, "foot-ok");
  ok("FOOT: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ ACKLESSON: уроки раздела пройдены — «Ознакомлена» прямо внизу раздела ═════════════════════════
if (want("ACKLESSON")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await toTrack(page, "seasonal"); await toConceptPage(page);
  // проходим уроки раздела (самопроверку не нужно)
  for (let i = 0; i < 12; i++) {
    const next = page.locator(".tbp-cur .tbm-cur");
    if (!(await next.count())) break;
    const lbl = (await next.getAttribute("aria-label")) || "";
    if (/самопровер|тест/i.test(lbl)) break;
    await next.click(); await page.waitForTimeout(1300);
    await toEnd(page);
    const done = page.locator("button:has-text('Урок пройден')");
    if (await done.count()) { await done.first().click(); await page.waitForTimeout(1500); }
    if ((await screenName(page)) !== "home") { await toTrack(page, "seasonal"); await toConceptPage(page); }
    if (await page.locator('.tbp-cur [data-cn-footack="go"]').count()) break;
  }
  ok("ACKLESSON: уроки пройдены — «Ознакомлена» доступна", (await page.locator('.tbp-cur [data-cn-footack="go"]').count()) === 1 && !(await page.locator(".tbp-cur [data-cn-footack]").isDisabled()));
  await page.locator(".tbp-cur [data-cn-footack]").click();
  ok("ACKLESSON: отметка — в разделе «Ознакомлена», на сервере дата", !!(await until(() => page.locator(".tbp-cur [data-cn-footok]").count(), 6000))
    && !!(await srvCall(page, "concept_get", "e-anna")).read_at.venue);
  ok("ACKLESSON: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ NEWBIE: «Знакомство с компанией» в первый день ══════════════════════════════════════════════
if (want("NEWBIE")) {
  const { ctx, page, errs } = await open({ who: "ksenia" });
  await nav(page, "newbie", 2200);
  const st = page.locator('[data-nb-step="d1e"]');
  ok("NEWBIE: шаг «Знакомство с компанией» — в первом дне, ведёт в раздел", (await st.count()) === 1 && /Знакомство с компанией/.test(await txt(st)) && /прочитай и отметь «Ознакомлен\(а\)»/.test(await txt(st))
    && (await st.locator("[data-nb-open]").count()) === 1 && (await st.getAttribute("data-nb-done")) === "0", await txt(st));
  await st.scrollIntoViewIfNeeded(); await shot(page, "newbie-step");
  await st.locator("[data-nb-open]").click(); await page.waitForTimeout(1600);
  ok("NEWBIE: «Открыть» — раздел «О нас» в треке", (await screenName(page)) === "module" && /Наш ресторан/.test(await body(page)), await screenName(page));
  await about(page); await bottom(page); await page.locator("[data-cn-read]").click(); await until(() => page.locator("[data-cn-readok]").count(), 5000);
  await nav(page, "newbie", 2200);
  ok("NEWBIE: отметила «Ознакомлена» — шаг отмечен сам", !!(await until(async () => (await page.locator('[data-nb-step="d1e"]').getAttribute("data-nb-done")) === "1", 5000)));
  const me = await srvCall(page, "newbie_me", "e-ksenia");
  ok("NEWBIE: на сервере шаг d1e отмечен (руководитель видит)", !!(me.checked && me.checked.d1e), JSON.stringify(me.checked));
  ok("NEWBIE: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ WORD: картинки из Word сразу в блоки ═════════════════════════════════════════════════════
if (want("WORD")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  const jpg = await page.evaluate(async () => { const c = document.createElement("canvas"); c.width = 640; c.height = 420; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 640, 420); g.addColorStop(0, "#6b4a2a"); g.addColorStop(1, "#d8b77a"); x.fillStyle = g; x.fillRect(0, 0, 640, 420);
    x.fillStyle = "#fff"; x.font = "48px serif"; x.fillText("Зал", 40, 90); return c.toDataURL("image/jpeg", 0.85).split(",")[1]; });
  const img = Buffer.from(jpg, "base64");
  const REL = (id, f) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${f}"/>`;
  const file = docxPics(`<w:document><w:body>${W("Атмосфера", "Heading1")}${W("", "", PIC("rId7", "Зал вечером"))}${W("Тёплый свет, джаз по вечерам, свечи на столах.")}`
    + `${W("Внешний вид", "Heading1")}${W("Форма: чёрный верх, фартук, тёмные брюки, закрытая обувь.", "", PIC("rId8", "Форма зала"))}${W("Рисунок Office", "", PIC("rId9", "схема"))}</w:body></w:document>`,
    `<Relationships>${REL("rId7", "image1.jpeg")}${REL("rId8", "image2.jpeg")}${REL("rId9", "image3.emf")}</Relationships>`,
    [["word/media/image1.jpeg", img], ["word/media/image2.jpeg", img], ["word/media/image3.emf", img]]);
  await editor(page);
  await page.locator('[data-cn-tab="venue"]').click(); await page.waitForTimeout(700);
  await page.locator("[data-cn-doc]").click(); await page.waitForTimeout(500);
  await page.locator("[data-cn-docfile] input").setInputFiles({ name: "Концепция.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: file });
  await page.waitForTimeout(900);
  const text = await page.locator("[data-cn-doctext]").inputValue();
  ok("WORD: текст и метки «[фото 1]», «[фото 2]» на месте картинок; рисунок Office пропущен", /\[фото 1\]/.test(text) && /\[фото 2\]/.test(text) && !/\[фото 3\]/.test(text), text.slice(0, 300));
  ok("WORD: под полем — «и фото: 2»", /фото: 2/.test(await txt(page.locator("[data-cn-docnote]"))), await txt(page.locator("[data-cn-docnote]")));
  await page.locator("[data-cn-docrun]").click();
  await until(() => page.locator('[data-cn-docbox="review"]').count(), 15000);
  const mood = page.locator('[data-cn-docblock="mood"] [data-cn-docphotos]'), dress = page.locator('[data-cn-docblock="dress"] [data-cn-docphotos]');
  ok("WORD: помощник разложил фото: зал — к атмосфере, форма — к внешнему виду", (await mood.getAttribute("data-cn-docphotos")) === "1" && (await dress.getAttribute("data-cn-docphotos")) === "2",
    [await mood.getAttribute("data-cn-docphotos").catch(() => "-"), await dress.getAttribute("data-cn-docphotos").catch(() => "-")].join(" | "));
  ok("WORD: у фото — подпись из Word и выбор, куда поставить", /Зал вечером/.test(await txt(page.locator('[data-cn-docpic="1"]').first())) && (await page.locator('[data-cn-docpicto="1"]').count()) === 1);
  await page.locator('[data-cn-docblock="mood"]').scrollIntoViewIfNeeded(); await shot(page, "word-review");
  // фото формы — не брать
  await page.locator('[data-cn-docpicto="2"]').first().selectOption("-1"); await page.waitForTimeout(300);
  ok("WORD: «Не брать» — фото без блока, отдельной строкой", (await page.locator("[data-cn-docspare]").getAttribute("data-cn-docspare")) === "2" && !(await page.locator('[data-cn-docblock="dress"] [data-cn-docphotos]').count()));
  const miss = await lensMiss(page);
  ok("WORD: метки «Линзы» на месте", !miss.length, JSON.stringify(miss));
  await page.locator("[data-cn-docadd]").click();
  ok("WORD: сохранено — «Фото из документа: 1»", !!(await until(async () => /Фото из документа: 1/.test(await txt(page.locator("[data-cn-msg]"))), 15000)), await txt(page.locator("[data-cn-msg]")));
  const g = await srvCall(page, "concept_get", "u-maria");
  const m2 = g.venue.blocks.filter((b) => b.kind === "mood");
  ok("WORD: в блоке атмосферы — фото с подписью «Зал вечером», в тексте меток нет", m2.length === 1 && m2[0].photos.length === 1 && m2[0].photos[0].cap === "Зал вечером" && !/\[фото/.test(m2[0].body), JSON.stringify(m2.map((b) => [b.photos, b.body.slice(0, 80)])));
  ok("WORD: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ NO58: сервер без этапа 58 ══════════════════════════════════════════════════════════════════
if (want("NO58")) {
  const { ctx, page, errs } = await open({ who: "anna", no58: true });
  await about(page);
  ok("NO58: обложка и отметка работают", (await page.locator("[data-cn-cover]").count()) === 1 && (await page.locator('[data-cn-status="new"]').count()) === 1);
  await bottom(page); await page.locator("[data-cn-read]").click();
  ok("NO58: «Ознакомлена» — без даты (этапа нет)", !!(await until(() => page.locator("[data-cn-readok]").count(), 5000)) && /^Ознакомлена Обновят/.test(await txt(page.locator("[data-cn-readok]"))), await txt(page.locator("[data-cn-readok]")));
  await asWho(page, "maria");
  await editor(page);
  await page.locator('[data-cn-tab="venue"]').click(); await page.waitForTimeout(700);
  ok("NO58: удалённых блоков нет", !(await page.locator("[data-cn-gone]").count()));
  await page.locator('[data-cn-open="setting"]').click(); await page.waitForTimeout(900);
  await page.locator("[data-cn-hist]").click(); await page.waitForTimeout(900);
  ok("NO58: история блока — «появится с этапом 58»", (await page.locator('[data-cn-history="missing"]').count()) === 1 && /этапом 58/.test(await txt(page.locator("[data-cn-history]"))));
  ok("NO58: без ошибок", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ═══ LOOK: 320 px и «Для чтения» ════════════════════════════════════════════════════════════════
if (want("LOOK")) {
  for (const [w, light] of [[320, false], [390, true]]) {
    const tag = "LOOK " + w + (light ? " светлая" : "");
    const { ctx, page, errs } = await open({ who: "anna", width: w, light });
    await about(page);
    ok(tag + ": «О нас» с обложкой — без прокрутки вбок", (await overflowX(page)) <= 0);
    await shot(page, "look-about-" + w + (light ? "-light" : ""));
    await bottom(page); await shot(page, "look-ack-" + w + (light ? "-light" : ""));
    await page.locator("[data-cn-pitch]").scrollIntoViewIfNeeded(); await page.locator("[data-cn-pitch]").click(); await page.waitForTimeout(1300);
    await page.locator("[data-pitch-start]").click(); await page.waitForTimeout(600);
    ok(tag + ": тренажёр — без прокрутки вбок", (await overflowX(page)) <= 0);
    await shot(page, "look-pitch-" + w + (light ? "-light" : ""));
    ok(tag + ": без ошибок", !errs.length, errs.join(" | "));
    await ctx.close();
  }
}

console.log("\nитог: " + pass + " ✓, " + fail + " ✗");
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
