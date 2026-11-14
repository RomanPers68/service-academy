// e2e v161 (Доп. 486): лица рядом с сообщениями коллег в общих чатах. Сайт — демо целиком (tools/claude/demo-app/build.mjs:
// сервер в странице, его состояние переживает смену человека: __demo_who + перезагрузка; __demo_no52 = "1" — сервер без фото).
// В демо фото стоят у Марии, Веры, Петра, Дарьи, Ильи и Ольги; у Анны, Ксении, Тимура и Романа — нет.
// Разделы:
//   FEED  — «Вся команда» глазами Анны: у каждого столбика чужих сообщений один кружок, у последнего пузыря; фото или
//           буквы; геометрия (30 px, у хвостика, пузыри сдвинуты, имена на месте); у своих и у карточек кружка нет;
//           нажатие на кружок открывает карточку коллеги (не меню сообщения), в ней фото крупно; касанию 44 px;
//   RUN   — человек дописал ещё одно сообщение — кружок переехал к нему; у человека без фото — буквы;
//   AI    — ответ Наставника: кружок со значком в колонке, значок из строки имени убран, имя и пузырь в общей линии;
//   PHOTO — фото в пузыре рядом с кружком не вылезает ни на 390, ни на 320 px;
//   DM    — личный чат: кружков нет, пузыри на прежнем месте;
//   NO52  — сервер без этапа 52: лента «Вся команда» прежняя (пузырь с 16-й точки, имя с 28-й), значок Наставника в имени;
//   LOOK  — «Для чтения» и 320 px: ничего не вылезает вбок, кружки на месте.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v161.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5610, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v161";
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
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 700) : "")); } };
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
async function open({ who = "maria", light = false, width = 390, height = 844, hour = 19, minute = 30, no52 = false, nopos = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n, p]) => { localStorage.clear(); localStorage.setItem("__demo_who", w); if (n) localStorage.setItem("__demo_no52", "1"); if (p) localStorage.setItem("__demo_nopos", "1"); }, [who, no52, nopos]);
  await page.evaluate(([h, m]) => { const real = performance.timeOrigin + performance.now(); const d = new Date();
    localStorage.setItem("__demo_t", JSON.stringify({ off: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).getTime() - real, at: real })); }, [hour, minute]);
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
const switchWho = async (page, errs, who) => { await page.evaluate((w) => { localStorage.setItem("__demo_who", w); localStorage.removeItem("__demo_me"); }, who); await page.reload({ waitUntil: "load" }); await ready(page, errs); };
const nav = async (page, s, ms = 1800) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms);
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await page.waitForTimeout(250); };
const overflowX = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });

const PHOTO = fileURLToPath(new URL("../../public/reference/wine_present.jpg", import.meta.url));
const tgBack = async (page) => { const what = await page.evaluate(() => { const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const root = document.getElementById("root"); const layers = [...document.body.children].filter((el) => el !== root && el.tagName !== "SCRIPT").reverse(); if (root) layers.push(root);
  for (const l of layers) { const m = [...l.querySelectorAll("[data-sa-back], [aria-label='Назад']")].find(vis); if (m) { const w = m.hasAttribute("data-face-x") ? "face" : (m.className || m.getAttribute("aria-label") || m.tagName); m.click(); return String(w); } } return ""; });
  await page.waitForTimeout(450); return what; };
const toTeam = async (page) => { await page.locator("[data-chat-dock]").click(); await page.waitForTimeout(1200); await page.locator('[data-chat-item="team"]').first().click(); await page.waitForTimeout(1600); };
const say = async (page, t) => { await page.locator("[data-chat-input]").fill(t); await page.waitForTimeout(250); await page.locator("[data-chat-send]").click(); await page.waitForTimeout(900); };
// лента: строки сообщений по порядку — сторона, автор, где пузырь, есть ли кружок
const feed = (page) => page.evaluate(() => { const f = document.querySelector(".ch-feed"); if (!f) return null; const fr = f.getBoundingClientRect();
  const rows = [...f.querySelectorAll(".ch-row[data-chat-msg]")].map((r) => { const b = r.querySelector(".ch-b, .ch-call, .ch-card, .ch-sys"), br = b ? b.getBoundingClientRect() : null, a = r.querySelector(".ch-mava"), ar = a ? a.getBoundingClientRect() : null, nm = r.querySelector(".ch-nm, .ch-ai-nm"), nr = nm ? nm.getBoundingClientRect() : null;
    const side = r.classList.contains("in") ? "in" : r.classList.contains("out") ? "out" : "mid";
    return { id: r.getAttribute("data-chat-msg"), side, cont: r.classList.contains("cont"), same: r.classList.contains("same"), ai: r.hasAttribute("data-chat-ai"), name: nm ? nm.textContent.trim() : "", nameX: nr ? Math.round(nr.left) : null,
      bx: br ? Math.round(br.left) : null, br: br ? Math.round(br.right) : null, bb: br ? Math.round(br.bottom) : null,
      ava: a ? { emp: a.getAttribute("data-chat-ava"), tag: a.tagName, img: !!a.querySelector("img[data-face]"), txt: a.textContent.trim(), x: Math.round(ar.left), w: Math.round(ar.width), h: Math.round(ar.height), bottom: Math.round(ar.bottom), right: Math.round(ar.right),
        hidden: a.getAttribute("aria-hidden"), tab: a.getAttribute("tabindex"), round: getComputedStyle(a).borderRadius === "50%" } : null }; });
  return { cls: f.className, left: Math.round(fr.left), right: Math.round(fr.right), vw: innerWidth, rows }; });
// столбики: подряд идущие чужие сообщения одного автора (имя стоит над первым)
const runs = (rows) => { const out = []; let cur = null; for (const r of rows) { if (r.side !== "in") { cur = null; continue; } if (!r.same || !cur) { cur = { rows: [] }; out.push(cur); } cur.rows.push(r); } return out; };

// ═══ FEED: лента общего чата ════════════════════════════════════════════════════════════════════════════
if (want("FEED")) {
  const { ctx, page, errs } = await open({ who: "ksenia" });
  await toTeam(page); await say(page, "Кто видел мой блокнот?"); await say(page, "Нашла, спасибо!");
  await switchWho(page, errs, "maria"); await toTeam(page); await say(page, "Коллеги, в 21:00 банкет на 12 гостей."); await say(page, "Столы 5 и 6 сдвигаем.");
  await switchWho(page, errs, "anna"); await toTeam(page); await say(page, "Я на шестом.");
  const f = await feed(page);
  ok("FEED: лента общего чата — с лицами", f && / ava$/.test(f.cls), f && f.cls);
  const ins = f.rows.filter((r) => r.side === "in"), rr = runs(f.rows);
  ok("FEED: у каждого столбика чужих сообщений ровно один кружок — у последнего пузыря", rr.length >= 4 && rr.every((g) => g.rows.filter((r) => r.ava).length === 1 && !!g.rows[g.rows.length - 1].ava && g.rows.every((r, i) => (i < g.rows.length - 1) === r.cont)), rr.map((g) => g.rows.map((r) => (r.ava ? "●" : "○")).join("")));
  ok("FEED: есть столбики из двух сообщений: кружок у второго, у первого нет", rr.filter((g) => g.rows.length === 2).length >= 2 && rr.filter((g) => g.rows.length === 2).every((g) => !g.rows[0].ava && g.rows[1].ava));
  ok("FEED: у своих сообщений и у карточек посередине кружков нет", f.rows.filter((r) => r.side !== "in").length >= 2 && f.rows.filter((r) => r.side !== "in").every((r) => !r.ava));
  const av = ins.filter((r) => r.ava).map((r) => ({ ...r.ava, bb: r.bb, bx: r.bx }));
  ok("FEED: кружок 30 px, круглый, слева от пузыря у его нижнего края (куда смотрит хвостик)", av.every((a) => a.w === 30 && a.h === 30 && a.round && a.x === f.left + 14 && Math.abs(a.bottom - a.bb) <= 1 && a.bx - a.right === 8), av);
  ok("FEED: пузыри чужих сообщений — в одну линию правее кружка, не шире ленты", ins.every((r) => r.bx === f.left + 52 && r.br <= f.right - 10), ins.map((r) => [r.bx, r.br]));
  ok("FEED: имя над первым пузырём столбика — на месте, над текстом пузыря", rr.every((g) => g.rows[0].name.length > 2 && g.rows[0].nameX === f.left + 64) && ins.filter((r) => r.same).every((r) => !r.name), rr.map((g) => [g.rows[0].name, g.rows[0].nameX]));
  const byEmp = Object.fromEntries(av.map((a) => [a.emp, a]));
  ok("FEED: у Марии, Ильи и Ольги в кружке фото; у Ксении фото нет — буквы «КМ»", ["u-maria", "e-ilya", "e-olga"].every((e) => byEmp[e] && byEmp[e].img) && byEmp["e-ksenia"] && !byEmp["e-ksenia"].img && byEmp["e-ksenia"].txt === "КМ", byEmp);
  ok("FEED: кружок — кнопка для касания, диктору не читается и в обход по клавишам не встаёт (та же кнопка — имя)", av.every((a) => a.tag === "BUTTON" && a.hidden === "true" && a.tab === "-1"), av.map((a) => [a.tag, a.hidden, a.tab]));
  ok("FEED: фото в кружках загрузились и касаний не перехватывают", await page.evaluate(() => [...document.querySelectorAll(".ch-mava img[data-face]")].every((i) => i.complete && i.naturalWidth > 0 && getComputedStyle(i).pointerEvents === "none" && !i.hasAttribute("data-face-zoom"))));
  ok("FEED: вбок ничего не вылезает", (await overflowX(page)) <= 0);
  await page.evaluate(() => { const c = document.querySelector("[data-chat-feed]"); if (c) c.scrollTop = c.scrollHeight; }); await page.waitForTimeout(400);
  await shot(page, "feed-1-team");
  // касание: зона 44 px, открывается карточка коллеги, а не меню сообщения
  const hit = await page.evaluate(() => { const a = [...document.querySelectorAll('.ch-mava[data-chat-ava="u-maria"]')].pop(), r = a.getBoundingClientRect(), cy = r.top + r.height / 2;
    const at = (x, y) => document.elementFromPoint(x, y); return { left: at(r.left - 5, cy) === a, top: at(r.left + 15, r.top - 5) === a, far: at(r.left - 9, cy) === a, bubble: at(r.right + 10, cy) === a }; });
  ok("FEED: касанию у кружка 44 px (на 7 px шире кружка), пузырь рядом он не закрывает", hit.left && hit.top && !hit.far && !hit.bubble, hit);
  await page.locator('.ch-mava[data-chat-ava="u-maria"]').last().click(); await page.waitForTimeout(1300);
  const card = await page.evaluate(() => { const s = document.querySelector(".ch-sheet[data-chat-person]"); return s ? { emp: s.getAttribute("data-chat-person"), name: s.querySelector(".ch-pp-n").textContent, face: !!s.querySelector("[data-chat-person-face] img[data-face-zoom]"), dm: !!s.querySelector("[data-chat-person-dm]") } : null; });
  ok("FEED: нажал на кружок — карточка этого коллеги (с фото и «Написать лично»)", card && card.emp === "u-maria" && card.name === "Мария Ким" && card.face && card.dm, card);
  ok("FEED: меню сообщения при этом не открылось", (await page.locator("[data-chat-menu], [data-chat-msgsheet]").count()) === 0 && (await page.locator(".ch-sheet").count()) === 1);
  await shot(page, "feed-2-card");
  await page.locator("[data-chat-person-face] img[data-face-zoom]").click(); await page.waitForSelector('[data-face-photo="full"]', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(300);
  const big = await page.evaluate(() => { const v = document.querySelector("[data-face-view]"); return v ? { id: v.getAttribute("data-face-view"), name: v.querySelector("[data-face-name]").textContent, state: v.querySelector("[data-face-photo]").getAttribute("data-face-photo") } : null; });
  ok("FEED: из карточки — фото крупно", big && big.id === "u-maria" && big.name === "Мария Ким" && big.state === "full", big);
  const b1 = await tgBack(page), n1 = await page.locator(".ch-sheet[data-chat-person]").count(), v1 = await page.locator("[data-face-view]").count();
  const b2 = await tgBack(page), n2 = await page.locator(".ch-sheet[data-chat-person]").count();
  ok("FEED: «назад» закрывает фото, потом карточку; лента на месте", b1 === "face" && v1 === 0 && n1 === 1 && n2 === 0 && (await page.locator(".ch-feed.ava").count()) === 1, [b1, n1, b2, n2]);
  // имя над пузырём открывает ту же карточку, что и кружок
  await page.locator('[data-chat-who="e-ksenia"]').first().click(); await page.waitForTimeout(1200);
  const byName = await page.evaluate(() => { const s = document.querySelector(".ch-sheet[data-chat-person]"); return s ? s.getAttribute("data-chat-person") : null; });
  await tgBack(page);
  await page.locator('.ch-mava[data-chat-ava="e-ksenia"]').last().click(); await page.waitForTimeout(1200);
  const byAva = await page.evaluate(() => { const s = document.querySelector(".ch-sheet[data-chat-person]"); return s ? { emp: s.getAttribute("data-chat-person"), ini: s.querySelector("[data-chat-person-face]").textContent.trim(), img: !!s.querySelector("[data-chat-person-face] img") } : null; });
  ok("FEED: кружок и имя открывают одну карточку; у Ксении в ней буквы", byName === "e-ksenia" && byAva && byAva.emp === "e-ksenia" && byAva.ini === "КМ" && !byAva.img, { byName, byAva });
  await tgBack(page);
  ok("FEED: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ RUN: кружок переезжает к последнему сообщению ══════════════════════════════════════════════════════
if (want("RUN")) {
  const { ctx, page, errs } = await open({ who: "ksenia" });
  await toTeam(page); await say(page, "Первое сообщение Ксении");
  await switchWho(page, errs, "anna"); await toTeam(page);
  let f = await feed(page);
  const one = f.rows.filter((r) => r.side === "in").pop();
  ok("RUN: одно сообщение — кружок у него, имя над ним", one && one.ava && one.ava.emp === "e-ksenia" && one.ava.txt === "КМ" && one.name === "Ксения М." && !one.cont, one);
  await switchWho(page, errs, "ksenia"); await toTeam(page); await say(page, "Второе, вдогонку");
  await switchWho(page, errs, "anna"); await toTeam(page);
  f = await feed(page);
  const two = f.rows.filter((r) => r.side === "in").slice(-2);
  ok("RUN: дописала второе — кружок переехал к нему, у первого его больше нет; имя осталось над первым", two.length === 2 && two[0].id === one.id && !two[0].ava && two[0].cont && two[0].name === "Ксения М." && two[1].ava && two[1].ava.emp === "e-ksenia" && !two[1].name, two);
  ok("RUN: оба пузыря в одной линии", two[0].bx === two[1].bx && two[0].bx === f.left + 52, two.map((r) => r.bx));
  await shot(page, "run-1-two");
  ok("RUN: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ AI: ответ Наставника ═══════════════════════════════════════════════════════════════════════════════
if (want("AI")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await toTeam(page); await say(page, "@Наставник что подать к белой рыбе?");
  await page.waitForFunction(() => document.querySelectorAll("[data-chat-ai]").length >= 1, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const f = await feed(page);
  const ai = f.rows.find((r) => r.ai), other = f.rows.find((r) => r.side === "in" && !r.ai && r.name);
  const dot = await page.evaluate(() => { const d = document.querySelector("[data-chat-ai] .ch-ai-d"); const a = document.querySelector('[data-chat-ai] .ch-mava[data-chat-ava="ai"]'); return { inline: d ? getComputedStyle(d).display : "нет", svg: a ? !!a.querySelector("svg") : false, tag: a ? a.tagName : "" }; });
  ok("AI: Наставник ответил в ленте", !!ai, f.rows.map((r) => r.side + (r.ai ? "*" : "")));
  ok("AI: у ответа — кружок со значком в той же колонке (не кнопка: карточки у него нет)", ai && ai.ava && ai.ava.emp === "ai" && ai.ava.w === 30 && ai.ava.x === f.left + 14 && Math.abs(ai.ava.bottom - ai.bb) <= 1 && dot.svg && dot.tag === "SPAN", { ai, dot });
  ok("AI: значок из строки имени убран, имя и пузырь — в одной линии с коллегами", dot.inline === "none" && ai && other && ai.nameX === other.nameX && ai.bx === other.bx && ai.name.endsWith("Наставник"), { dot, ai: ai && [ai.nameX, ai.bx, ai.name], other: other && [other.nameX, other.bx] });
  await page.evaluate(() => { const a = document.querySelector("[data-chat-ai]"); if (a) a.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(400);
  await shot(page, "ai-1-reply");
  ok("AI: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ PHOTO: фото в пузыре рядом с кружком ═══════════════════════════════════════════════════════════════
if (want("PHOTO")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  await toTeam(page);
  await page.locator("[data-chat-file]").setInputFiles(PHOTO); await page.waitForTimeout(1600);
  await page.locator("[data-chat-caption]").fill("Так ставим приборы"); await page.locator("[data-chat-photo-send]").click(); await page.waitForTimeout(2200);
  for (const [tag, width] of [["390", 390], ["320", 320]]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await switchWho(page, errs, "anna"); await toTeam(page);
    const p = await page.evaluate(() => { const ph = [...document.querySelectorAll(".ch-row.in [data-chat-photo]")].pop(); if (!ph) return null; const row = ph.closest(".ch-row"), b = row.querySelector(".ch-b").getBoundingClientRect(), r = ph.getBoundingClientRect(), a = row.querySelector(".ch-mava"), f = document.querySelector(".ch-feed").getBoundingClientRect(), img = ph.querySelector("img");
      return { phW: Math.round(r.width), phR: Math.round(r.right), bL: Math.round(b.left), bR: Math.round(b.right), bW: Math.round(b.width), feedR: Math.round(f.right), ava: a ? [Math.round(a.getBoundingClientRect().left), Math.round(a.getBoundingClientRect().bottom - b.bottom)] : null, vw: innerWidth, loaded: !!img && img.complete }; });
    const want0 = width === 320 ? 224 : 260;
    ok(`PHOTO ${tag}: фото ${want0} px — внутри пузыря, пузырь внутри ленты, кружок у нижнего края`, p && p.phW === want0 && p.phR <= p.bR && p.bW === want0 + 6 && p.bL === 62 - 10 && p.bR <= p.feedR - 10 && p.ava && p.ava[0] === 14 && Math.abs(p.ava[1]) <= 1, p);
    ok(`PHOTO ${tag}: вбок ничего не вылезает`, (await overflowX(page)) <= 0);
    await page.evaluate(() => { const c = document.querySelector("[data-chat-feed]"); if (c) c.scrollTop = c.scrollHeight; }); await page.waitForTimeout(400);
    await shot(page, "photo-" + tag);
    if (width === 390) { await switchWho(page, errs, "maria"); }
  }
  ok("PHOTO: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ DM: личный чат — как был ═══════════════════════════════════════════════════════════════════════════
if (want("DM")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await toTeam(page);
  await page.locator('.ch-mava[data-chat-ava="u-maria"]').last().click(); await page.waitForTimeout(1200);
  await page.locator("[data-chat-person-dm]").click(); await page.waitForTimeout(1600);
  await say(page, "Мария, можно подмениться в пятницу?");
  const mine = await feed(page);
  ok("DM: личный чат открылся из карточки, лента без лиц", mine && mine.cls === "ch-feed" && mine.rows.length === 1 && mine.rows[0].side === "out" && !mine.rows[0].ava, mine);
  await switchWho(page, errs, "maria");
  await page.locator("[data-chat-dock]").click(); await page.waitForTimeout(1200);
  const item = page.locator("[data-chat-item]").filter({ hasText: "Анна" }).first();
  ok("DM: у Марии личный чат с Анной в списке", (await item.count()) === 1);
  await item.click(); await page.waitForTimeout(1600);
  const f = await feed(page);
  const r = f && f.rows[0];
  ok("DM: входящее в личном чате — без кружка и без имени, пузырь на прежнем месте (с 16-й точки)", f && f.cls === "ch-feed" && r && r.side === "in" && !r.ava && !r.name && r.bx === f.left + 16 && (await page.locator(".ch-mava").count()) === 0, f);
  await shot(page, "dm-1-thread");
  ok("DM: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ NO52: сервер без этапа 52 ══════════════════════════════════════════════════════════════════════════
if (want("NO52")) {
  const { ctx, page, errs } = await open({ who: "anna", no52: true });
  await toTeam(page); await say(page, "@Наставник что подать к белой рыбе?");
  await page.waitForFunction(() => document.querySelectorAll("[data-chat-ai]").length >= 1, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const f = await feed(page);
  const ins = f.rows.filter((r) => r.side === "in"), named = ins.filter((r) => r.name && !r.ai), ai = ins.find((r) => r.ai);
  ok("NO52: лента без лиц: кружков нет", f.cls === "ch-feed" && ins.length >= 3 && ins.every((r) => !r.ava) && (await page.locator(".ch-mava").count()) === 0, f.cls);
  ok("NO52: пузыри и имена на прежних местах (пузырь с 16-й точки, имя с 28-й)", ins.every((r) => r.bx === f.left + 16) && named.length >= 2 && named.every((r) => r.nameX === f.left + 28), ins.map((r) => [r.bx, r.nameX]));
  const dot = await page.evaluate(() => { const d = document.querySelector("[data-chat-ai] .ch-ai-d"); return d ? [getComputedStyle(d).display, Math.round(d.getBoundingClientRect().width)] : null; });
  ok("NO52: у Наставника значок в строке имени, как был", !!ai && dot && dot[0] !== "none" && dot[1] === 20, dot);
  await shot(page, "no52-1-team");
  ok("NO52: ошибок в странице нет", errs.length === 0, errs);
  await ctx.close();
}

// ═══ LOOK: «Для чтения» и 320 px ════════════════════════════════════════════════════════════════════════
if (want("LOOK")) {
  for (const [tag, o] of [["lt", { light: true }], ["320", { width: 320, height: 568 }], ["320lt", { width: 320, height: 568, light: true }]]) {
    const { ctx, page, errs } = await open({ who: "maria", ...o });
    await toTeam(page); await say(page, "Аперитив подаём сразу, меню согласовано, по аллергиям: у одного гостя орехи, предупредите кухню и бар заранее."); await say(page, "Ок?");
    await switchWho(page, errs, "anna");   // вид «Для чтения» хранится на телефоне: после смены человека он тот же
    await toTeam(page);
    const f = await feed(page);
    const ins = f.rows.filter((r) => r.side === "in");
    ok(`LOOK ${tag}: лента с лицами, пузыри внутри ленты, кружки в своей колонке`, / ava$/.test(f.cls) && ins.length >= 4 && ins.every((r) => r.bx === f.left + 52 && r.br <= f.right - 10) && ins.filter((r) => r.ava).every((r) => r.ava.x === f.left + 14 && r.ava.w === 30), ins.map((r) => [r.bx, r.br]));
    const long = ins.find((r) => r.br - r.bx > 180);
    ok(`LOOK ${tag}: длинное сообщение занимает строку до правого поля`, !!long && long.br >= f.right - 10 - Math.round((f.right - f.left - 20) * 0.08) - 2, long && [long.bx, long.br, f.right]);
    const ink = await page.evaluate(() => { const a = [...document.querySelectorAll(".ch-mava")].find((x) => !x.querySelector("img")); if (!a) return null; const cs = getComputedStyle(a); return { color: cs.color, fs: cs.fontSize, txt: a.textContent.trim() }; });
    ok(`LOOK ${tag}: буквы в кружке не мельче 10,5 px`, !ink || parseFloat(ink.fs) >= 10.5, ink);
    ok(`LOOK ${tag}: вбок ничего не вылезает`, (await overflowX(page)) <= 0);
    await page.evaluate(() => { const c = document.querySelector("[data-chat-feed]"); if (c) c.scrollTop = c.scrollHeight; }); await page.waitForTimeout(400);
    await shot(page, "look-" + tag);
    ok(`LOOK ${tag}: ошибок в странице нет`, errs.length === 0, errs);
    await ctx.close();
  }
}

await browser.close(); server.close();
console.log(`\nитог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
