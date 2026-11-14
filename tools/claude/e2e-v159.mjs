// e2e v159 (Доп. 484): четыре находки для главной из совета Google («Давай все 4»). Сайт — демо целиком
// (tools/claude/demo-app/build.mjs: сервер в странице; экран открывает window.__saNav; человек демо меняется в том же окне:
// __demo_who + перезагрузка; __demo_pulse = "1" — тесты сданы на этой неделе; __demo_no52 = "1" — сервер без фото).
// В демо у «Океана» в стопе два блюда и одно вино; у Анны сегодня смена «День · 12:00–20:00».
// Разделы:
//   LIVE   — «Мой график»: в 19:30 вместо «День» зелёное «Идёт», риска «сейчас» зелёная, диктору «смена идёт»; в 9:30 и
//            в 20:30 — как раньше; плитка той же высоты; в «Графике» у ближайшей смены «идёт» зелёным; «Для чтения»;
//   PULSE  — «Пульс недели» у владельца: одна строка той же высоты, лицо лидера под короной стоит перед именем, нажатие
//            ведёт в рейтинг; без этапа 52 — буквы; сотруднику плашки нет; «Для чтения»; 320 px;
//   SEAL   — «Книга отзывов»: первый пустой кружок — оттиск в кольце, число то же, что на кружке трека; остальные пустые;
//            плитка той же высоты; «Для чтения»;
//   STOP   — число «в стопе» на значке «Меню» (вино не в счёт), жетон не обрезан рядом, диктору «Меню. В стопе 2 блюда»
//            (подсказка title — по-прежнему «Меню»: по ней значки находят прежние проверки); «Меню»: «Сегодня нет» с блюдами,
//            нажатие открывает колоду на блюде с лентой поверх фото; колода из списка режимов — с первой карточки;
//   FRESH  — свежесть: после запуска один menu_get (не два), пока свежо — запросов нет; руководитель ставит стоп из чата —
//            число на главной под чатом меняется сразу, «Вернуть в меню» — обратно; у официанта после входа — то же число;
//   NARROW — 320 и 360 px, обе темы: ничего не вылезает вбок, главная не выросла.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v159.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5590, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v159";
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
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(extra).slice(0, 600) : "")); } };
const browser = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// запросы к серверу с самого начала страницы (демо перехватывает fetch — встаём перед ним): [имя функции, мс от старта]
const SPY = `(() => { window.__rpcLog = []; const t0 = performance.now(); let cur = window.fetch;
  const wrap = (f) => function (input, init) { try { const m = String(typeof input === "string" ? input : (input && input.url) || "").match(/\\/rpc\\/([a-z_0-9]+)/); if (m) window.__rpcLog.push([m[1], Math.round(performance.now() - t0)]); } catch (e) {} return f.apply(this, arguments); };
  let mine = wrap(cur);
  Object.defineProperty(window, "fetch", { configurable: true, get() { return mine; }, set(v) { cur = v; mine = wrap(v); } }); })();`;
async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1300);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
}
async function open({ who = "anna", light = false, width = 390, height = 844, hour = 19, minute = 30, pulse = false, no52 = false, spy = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, p, n]) => { localStorage.clear(); localStorage.setItem("__demo_who", w); if (p) localStorage.setItem("__demo_pulse", "1"); if (n) localStorage.setItem("__demo_no52", "1"); }, [who, pulse, no52]);
  await page.evaluate(([h, m]) => { const real = performance.timeOrigin + performance.now(); const d = new Date();
    localStorage.setItem("__demo_t", JSON.stringify({ off: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).getTime() - real, at: real })); }, [hour, minute]);
  if (spy) await page.addInitScript(SPY);
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
const switchWho = async (page, errs, who) => { await page.evaluate((w) => { localStorage.setItem("__demo_who", w); localStorage.removeItem("__demo_me"); }, who); await page.reload({ waitUntil: "load" }); await ready(page, errs); };
const reload = async (page, errs) => { await page.reload({ waitUntil: "load" }); await ready(page, errs); };
const nav = async (page, s, ms = 1800) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms);
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await page.waitForTimeout(250); };
const overflowX = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });
const rpcs = (page, fn) => page.evaluate((n) => (window.__rpcLog || []).filter((x) => x[0] === n).map((x) => x[1]), fn);
const body = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
// плитки и ряд инструментов на главной: размеры, цвета, подписи
const homeInfo = (page) => page.evaluate(() => {
  const q = (s, r = document) => r.querySelector(s), box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.left.toFixed(1), y: +b.top.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), r: +b.right.toFixed(1), b: +b.bottom.toFixed(1) }; };
  const cs = (e, p) => (e ? getComputedStyle(e)[p] : null);
  const sched = q('[data-tile="schedule"]'), book = q('[data-tile="book"]'), live = q("[data-when-live]"), now = q("[data-now]"), when = q("[data-when]");
  const pulse = q("[data-pulse]"), leader = q("[data-pulse-leader]"), crown = q("[data-pulse-crown] svg"), lead = q("[data-pulse-lead]"), face = leader && leader.querySelector("img[data-face]");
  const next = q("[data-seal-next]"), row = q("[data-tools-row]"), badge = q("[data-stop-badge]"), disc = badge && badge.closest("[data-tool-disc]"), tool = disc && disc.parentElement;
  const menuTool = [...document.querySelectorAll("[data-tools-row] > div")].find((x) => /^Меню/.test(x.title || ""));
  const root = document.getElementById("root");
  return {
    sched: box(sched), book: box(book), aria: sched ? sched.getAttribute("aria-label") : null, whenText: when ? when.innerText.replace(/\s+/g, " ").trim() : null, whenClip: when ? when.scrollWidth - when.clientWidth : null,
    live: live ? { t: live.textContent, color: cs(live, "color") } : null, now: now ? { on: now.getAttribute("data-now"), bg: cs(now, "backgroundColor"), glow: cs(now, "boxShadow"), box: box(now) } : null,
    time: q("[data-when-time]") ? cs(q("[data-when-time]"), "color") : null,
    pulse: pulse ? { box: box(pulse), text: pulse.innerText.replace(/\s+/g, " ").trim(), go: pulse.hasAttribute("data-pulse-go"), role: pulse.getAttribute("role"), aria: pulse.getAttribute("aria-label"), cursor: cs(pulse, "cursor"), html: pulse.outerHTML } : null,
    leader: leader ? { box: box(leader), ini: leader.childNodes[0] && leader.childNodes[0].nodeType === 3 ? leader.childNodes[0].textContent : "", face: face ? face.getAttribute("data-face") : "", loaded: face ? face.naturalWidth > 0 : false, faceBox: box(face), round: face ? cs(face, "borderRadius") : "" } : null,
    crown: box(crown), lead: lead ? { box: box(lead), ws: cs(lead, "whiteSpace"), name: box(lead.lastElementChild), nameText: lead.lastElementChild.textContent } : null,
    next: next ? { pct: next.getAttribute("data-seal-next"), ready: next.hasAttribute("data-seal-ready"), aria: next.getAttribute("aria-label"), box: box(next), ring: !!next.querySelector("[data-seal-ring]"), dash: next.querySelector("[data-seal-ring]") ? next.querySelector("[data-seal-ring]").getAttribute("stroke-dasharray") : "", stroke: next.querySelector("[data-seal-ring]") ? next.querySelector("[data-seal-ring]").getAttribute("stroke") : "" } : null,
    empties: document.querySelectorAll("[data-seal-empty]").length, emptyBox: box(q("[data-seal-empty]")), sealsRow: next ? box(next.parentElement) : null,
    trackPct: q("[data-track-pct]") ? q("[data-track-pct]").textContent.trim() : null,
    badge: badge ? { t: badge.textContent, box: box(badge), bg: cs(badge, "backgroundImage"), color: cs(badge, "color"), font: cs(badge, "fontSize") } : null, disc: box(disc), row: box(row),
    tool: tool ? { title: tool.title, aria: tool.getAttribute("aria-label") } : null, menuTitle: menuTool ? menuTool.title : null, menuDot: menuTool ? [...menuTool.querySelectorAll("[data-tool-disc] > span")].filter((s) => !s.hasAttribute("data-stop-badge")).length : null,
    scroll: root ? root.scrollHeight - root.clientHeight : null, docScroll: document.documentElement.scrollHeight - innerHeight,
  };
});
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const openMenu = async (page) => { await page.evaluate(() => { const t = [...document.querySelectorAll("[data-tools-row] > div")].find((x) => /^Меню/.test(x.title || "")); if (t) t.click(); }); await page.waitForTimeout(2300); };
const openChat = async (page) => { await page.locator("[data-chat-dock]").click(); await page.waitForTimeout(900); await page.locator('[data-chat-item="team"]').first().click(); await page.waitForTimeout(1400); };
const closeChat = async (page) => { for (let i = 0; i < 4 && (await page.locator("[data-chat]").count()); i++) { const b = page.locator("[data-chat] .ch-back, [data-chat] .ch-x").first(); if (!(await b.count())) break; await b.click(); await page.waitForTimeout(700); } };
const badgeText = (page) => page.evaluate(() => { const b = document.querySelector("[data-stop-badge]"); return b ? b.textContent : ""; });
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String((e && e.message) || e).split("\n")[0].slice(0, 300)); } };

// ── LIVE ───────────────────────────────────────────────────────────────────────────────
await run("LIVE", async () => {
  const sizes = {};
  for (const light of [false, true]) {
    const tag = "LIVE" + (light ? " (для чтения)" : "");
    const green = rgb(light ? "#2C6B48" : "#8AD8AF"), gold = rgb(light ? "#7A5A22" : "#E2C484");
    const { ctx, page, errs } = await open({ who: "anna", light, hour: 19, minute: 30 });
    await nav(page, "roleSelect");
    const a = await homeInfo(page);
    ok(`${tag}: 19:30, смена 12–20 — на плитке «Идёт · 12:00–20:00», названия смены нет`, a.whenText === "Идёт · 12:00–20:00" || a.whenText === "Идёт ·12:00–20:00" || /^Идёт\s*·\s*12:00–20:00$/.test(a.whenText || ""), a.whenText);
    ok(`${tag}: «Идёт» — мягким зелёным, время — золотом, как было`, !!a.live && a.live.t === "Идёт" && a.live.color === green && a.time === gold, JSON.stringify([a.live, a.time]));
    ok(`${tag}: риска «сейчас» — зелёная с сиянием, 2 × 7 px, стоит на отрезке смены`, !!a.now && a.now.on === "on" && a.now.bg === green && /rgba?\(/.test(a.now.glow) && a.now.glow !== "none" && Math.abs(a.now.box.w - 2) < 0.6 && Math.abs(a.now.box.h - 7) < 0.6, JSON.stringify(a.now));
    ok(`${tag}: диктору — «Мой график. Сегодня: День, 12:00–20:00, смена идёт»`, a.aria === "Мой график. Сегодня: День, 12:00–20:00, смена идёт", a.aria);
    ok(`${tag}: подпись не обрезана, плитки одной высоты`, a.whenClip <= 0 && Math.abs(a.sched.h - a.book.h) < 0.6, JSON.stringify([a.whenClip, a.sched, a.book]));
    sizes[light ? "lt" : "dk"] = a.sched.h;
    await shot(page, "live-" + (light ? "lt" : "dk"));
    // «График»: у ближайшей смены «идёт» — тем же зелёным
    await nav(page, "schedule", 2600);
    const hero = await page.evaluate(() => { const l = document.querySelector("[data-hero-live]"), h = document.querySelector("[data-sched-hero]"), n = h && h.querySelector("[data-now]");
      return { live: l ? [l.textContent, getComputedStyle(l).color] : null, status: h ? h.getAttribute("data-hero-status") : null, text: h ? h.innerText.replace(/\s+/g, " ") : "", now: n ? [n.getAttribute("data-now"), getComputedStyle(n).backgroundColor] : null }; });
    ok(`${tag}: в «Графике» — «8 ч · идёт · ещё 30 мин», «идёт» зелёным, риска зелёная`, hero.status === "now" && !!hero.live && hero.live[0] === "идёт" && hero.live[1] === green && /8 ч · идёт · ещё 30 мин/.test(hero.text) && !!hero.now && hero.now[0] === "on" && hero.now[1] === green, JSON.stringify(hero).slice(0, 400));
    await shot(page, "live-hero-" + (light ? "lt" : "dk"));
    ok(`${tag}: без ошибок в консоли`, !errs.length, errs.join(" | "));
    await ctx.close();
  }
  for (const [hh, mm, word] of [[9, 30, "до смены"], [20, 30, "после смены"]]) {
    const { ctx, page, errs } = await open({ who: "anna", hour: hh, minute: mm });
    await nav(page, "roleSelect");
    const a = await homeInfo(page);
    ok(`LIVE: ${word} (${hh}:${mm}) — «День · 12:00–20:00», «Идёт» нет, риска золотая без сияния, слов «смена идёт» нет`, /^День\s*·\s*12:00–20:00$/.test(a.whenText || "") && !a.live && a.now.on === "off" && a.now.bg === rgb("#E2C484") && a.now.glow === "none" && a.aria === "Мой график. Сегодня: День, 12:00–20:00", JSON.stringify([a.whenText, a.live, a.now, a.aria]));
    ok(`LIVE: ${word} — плитка той же высоты, что и во время смены`, Math.abs(a.sched.h - sizes.dk) < 0.6, a.sched.h + " / " + sizes.dk);
    ok(`LIVE: ${word} — без ошибок в консоли`, !errs.length, errs.join(" | "));
    await ctx.close();
  }
});

// ── PULSE ──────────────────────────────────────────────────────────────────────────────
await run("PULSE", async () => {
  for (const light of [false, true]) {
    const tag = "PULSE" + (light ? " (для чтения)" : "");
    const { ctx, page, errs } = await open({ who: "roman", light, pulse: true });
    await nav(page, "roleSelect", 2400);
    const a = await homeInfo(page);
    ok(`${tag}: плашка есть, одна строка (высота как раньше: ${light ? 33 : 32} px)`, !!a.pulse && Math.abs(a.pulse.box.h - (light ? 33 : 32)) <= 1.2, a.pulse && JSON.stringify(a.pulse.box));
    ok(`${tag}: «Пульс недели · 4 теста · 4 чел в игре ·» и имя лидера; слова «лидер:» на экране нет`, !!a.pulse && /^Пульс недели · 4 теста · 4 чел в игре ·\s*(ВС)?\s*Вера Соколова$/.test(a.pulse.text) && !/лидер:/.test(a.pulse.text), a.pulse && a.pulse.text);
    ok(`${tag}: лицо лидера: фото Веры загружено, круглое, 22 px, на весь кружок`, !!a.leader && a.leader.face === "e-vera" && a.leader.loaded && Math.abs(a.leader.box.w - 22) < 0.6 && Math.abs(a.leader.box.h - 22) < 0.6 && Math.abs(a.leader.faceBox.w - 22) < 1 && /50%|11px/.test(a.leader.round), JSON.stringify(a.leader));
    ok(`${tag}: кружок по середине строки и внутри плашки; имя — сразу за ним, на той же строке`, !!a.leader && Math.abs((a.leader.box.y + 11) - (a.pulse.box.y + a.pulse.box.h / 2)) <= 2.5 && a.leader.box.y >= a.pulse.box.y && a.leader.box.b <= a.pulse.box.b
      && a.lead.ws === "nowrap" && a.lead.nameText === "Вера Соколова" && a.lead.name.x - a.leader.box.r >= 3 && a.lead.name.x - a.leader.box.r <= 8 && Math.abs((a.lead.name.y + a.lead.name.h / 2) - (a.leader.box.y + 11)) <= 3.5, JSON.stringify([a.pulse.box, a.leader.box, a.lead]));
    ok(`${tag}: корона — над кружком, по его середине, 12 px (с наклоном — до 14); за верх плашки не выходит больше чем на 2 px`, !!a.crown && a.crown.w >= 11.5 && a.crown.w <= 14.5 && a.crown.y < a.leader.box.y && Math.abs((a.crown.x + a.crown.w / 2) - (a.leader.box.x + 11)) <= 2 && a.crown.y >= a.pulse.box.y - 2.5, JSON.stringify([a.crown, a.leader.box, a.pulse.box]));
    ok(`${tag}: плашка — кнопка для диктора: «Пульс недели: 4 теста, в игре 4, лидер Вера Соколова. Открыть рейтинг»`, a.pulse.go && a.pulse.role === "button" && a.pulse.cursor === "pointer" && a.pulse.aria === "Пульс недели: 4 теста, в игре 4, лидер Вера Соколова. Открыть рейтинг", JSON.stringify([a.pulse.role, a.pulse.aria]));
    ok(`${tag}: ничего не движется (бегущей строки нет)`, !/animation|marquee/.test(a.pulse.html) && (await page.evaluate(() => getComputedStyle(document.querySelector("[data-pulse]")).animationName)) === "none");
    if (light) ok(`${tag}: в плашке нет светлого золота #C8A96E (на кремовом не читается)`, !/C8A96E/i.test(a.pulse.html) && /#7A5D2A|rgb\(122, 93, 42\)/i.test(a.pulse.html));
    ok(`${tag}: главная по-прежнему целиком на экране, вбок ничего не вылезает`, a.scroll <= 1 && (await overflowX(page)) <= 0, JSON.stringify([a.scroll, a.docScroll]));
    await shot(page, "pulse-" + (light ? "lt" : "dk"));
    await page.locator("[data-pulse]").click(); await page.waitForTimeout(1800);
    const lb = await body(page);
    ok(`${tag}: нажатие на плашку открывает рейтинг`, !(await page.locator("[data-pulse]").count()) && /Рейтинг|Лидеры|рейтинг/.test(lb), lb.slice(0, 200));
    if (!light) await shot(page, "pulse-rating");
    ok(`${tag}: без ошибок в консоли`, !errs.length, errs.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await open({ who: "roman", pulse: true, no52: true });
    await nav(page, "roleSelect", 2400);
    const a = await homeInfo(page);
    ok("PULSE: сервер без фото (нет этапа 52) — в кружке буквы «ВС», корона на месте, строка та же", !!a.leader && a.leader.ini === "ВС" && !a.leader.face && !!a.crown && /Пульс недели · 4 теста · 4 чел в игре ·\s*ВС\s*Вера Соколова$/.test(a.pulse.text) && Math.abs(a.pulse.box.h - 32) <= 1.2, JSON.stringify([a.leader, a.pulse.text, a.pulse.box]));
    await shot(page, "pulse-no52");
    ok("PULSE (без этапа 52): без ошибок в консоли", !errs.length, errs.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await open({ who: "roman", pulse: false });
    await nav(page, "roleSelect", 2400);
    ok("PULSE: на неделе тестов не было — плашки нет", !(await page.locator("[data-pulse]").count()));
    await switchWho(page, errs, "anna"); await page.evaluate(() => localStorage.setItem("__demo_pulse", "1")); await reload(page, errs); await nav(page, "roleSelect", 2200);
    ok("PULSE: сотруднику плашки нет (её видит владелец, как раньше)", !(await page.locator("[data-pulse]").count()));
    ok("PULSE: без ошибок в консоли", !errs.length, errs.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await open({ who: "roman", pulse: true, width: 320, height: 640 });
    await nav(page, "roleSelect", 2400);
    await page.evaluate(() => { const p = document.querySelector("[data-pulse]"); if (p) p.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(400);
    const a = await homeInfo(page);
    ok("PULSE 320 px: строка переносится, но лицо с именем — вместе; вбок ничего не вылезает", !!a.pulse && a.pulse.box.h > 40 && a.pulse.box.h < 56 && a.lead.box.w <= a.pulse.box.w - 20 && Math.abs((a.lead.name.y + a.lead.name.h / 2) - (a.leader.box.y + 11)) <= 3.5 && a.lead.name.r <= a.pulse.box.r - 8 && (await overflowX(page)) <= 0, JSON.stringify([a.pulse.box, a.leader.box, a.lead]));
    await shot(page, "pulse-320");
    ok("PULSE 320 px: без ошибок в консоли", !errs.length, errs.join(" | "));
    await ctx.close();
  }
});

// ── SEAL ───────────────────────────────────────────────────────────────────────────────
await run("SEAL", async () => {
  for (const light of [false, true]) {
    const tag = "SEAL" + (light ? " (для чтения)" : "");
    const { ctx, page, errs } = await open({ who: "anna", light });
    await nav(page, "roleSelect");
    const a = await homeInfo(page);
    ok(`${tag}: первый пустой кружок — оттиск следующей печати, остальные пять пустые`, !!a.next && a.empties === 5 && a.next.box.x < a.emptyBox.x, JSON.stringify([a.next, a.empties]));
    ok(`${tag}: кольцо — столько же, сколько на кружке трека (${a.trackPct})`, !!a.next && a.next.pct + "%" === a.trackPct && Number(a.next.pct) > 0 && a.next.ring && a.next.stroke === (light ? "#7A5D2A" : "#E8C983"), JSON.stringify([a.next, a.trackPct]));
    const len = 2 * Math.PI * 10.4, part = a.next ? Number(a.next.dash.split(" ")[0]) : -1;
    ok(`${tag}: длина дуги — ${a.next && a.next.pct}% окружности`, a.next && Math.abs(part - len * Number(a.next.pct) / 100) < 0.02, a.next && a.next.dash);
    ok(`${tag}: диктору — «Следующая печать: до экзамена пройдено ${a.next && a.next.pct}%»`, a.next && a.next.aria === `Следующая печать: до экзамена пройдено ${a.next.pct}%` && !a.next.ready, a.next && a.next.aria);
    ok(`${tag}: оттиск 17 px, но ряд печатей не подрос (13 px, как у пустых) и плитка той же высоты, что «Мой график»`, a.next && Math.abs(a.next.box.w - 17) < 0.6 && Math.abs(a.next.box.h - 17) < 0.6 && Math.abs(a.sealsRow.h - 13) < 0.6 && Math.abs(a.emptyBox.h - 13) < 0.6 && Math.abs(a.book.h - a.sched.h) < 0.6, JSON.stringify([a.next && a.next.box, a.sealsRow, a.book, a.sched]));
    await shot(page, "seal-" + (light ? "lt" : "dk"));
    await page.locator('[data-tile="book"]').click(); await page.waitForTimeout(1800);
    ok(`${tag}: плитка по-прежнему открывает «Книгу отзывов»`, /Книга отзывов/.test(await body(page)) && !(await page.locator('[data-tile="book"]').count()));
    ok(`${tag}: без ошибок в консоли`, !errs.length, errs.join(" | "));
    await ctx.close();
  }
});

// ── STOP ───────────────────────────────────────────────────────────────────────────────
await run("STOP", async () => {
  for (const light of [false, true]) {
    const tag = "STOP" + (light ? " (для чтения)" : "");
    const { ctx, page, errs } = await open({ who: "anna", light });
    await nav(page, "roleSelect"); await page.waitForTimeout(6500);   // сверка с сервером — через 5–6 с после запуска
    const a = await homeInfo(page);
    ok(`${tag}: на значке «Меню» — «2» (два блюда в стопе; вино в стопе в счёт не идёт)`, !!a.badge && a.badge.t === "2", JSON.stringify(a.badge));
    ok(`${tag}: жетон рубиновый, цифра 10,5 px светлая; у правого верхнего края кружка, рядом ничего не обрезает`, !!a.badge && /rgb\((200, 85, 60|180, 67, 47)\)/.test(a.badge.bg) && a.badge.font === "10.5px" && Math.abs(a.badge.box.h - 16) < 0.6 && a.badge.box.w >= 15.5 && a.badge.box.w <= 17
      && a.badge.box.y >= a.row.y - 0.6 && a.badge.box.r <= a.disc.r + 2.6 && a.badge.box.y <= a.disc.y && a.badge.box.x > a.disc.x + a.disc.w / 2, JSON.stringify([a.badge, a.disc, a.row]));
    ok(`${tag}: диктору — «Меню. В стопе 2 блюда», подсказка — по-прежнему «Меню»; золотой точки при числе нет`, !!a.tool && a.tool.title === "Меню" && a.tool.aria === "Меню. В стопе 2 блюда" && a.menuDot === 0, JSON.stringify([a.tool, a.menuDot]));
    await shot(page, "stop-home-" + (light ? "lt" : "dk"));
    await openMenu(page);
    const m = await page.evaluate(() => { const w = document.querySelector("[data-menu-stops]"); return w ? { n: w.getAttribute("data-menu-stops"), text: w.innerText.replace(/\s+/g, " ").trim(), chips: [...w.querySelectorAll("[data-menu-stop]")].map((c) => c.textContent.trim()), clip: w.scrollWidth - w.clientWidth, top: w.getBoundingClientRect().top, label: getComputedStyle(w.firstElementChild).color } : null; });
    ok(`${tag}: «Меню»: под шапкой — «Сегодня нет:» и оба блюда`, !!m && m.n === "2" && /^Сегодня нет:/.test(m.text) && m.chips.length === 2 && m.chips.join("|") === "Закуска из морепродуктов ›|Салат с крабом и страчателлой ›" && m.clip <= 0 && m.top < 420, JSON.stringify(m));
    ok(`${tag}: «Сегодня нет:» — красным (${light ? "тёмным на светлом" : "как «в стопе» в меню"})`, !!m && m.label === rgb(light ? "#A33A2A" : "#E07878"), m && m.label);
    await shot(page, "stop-menu-" + (light ? "lt" : "dk"));
    await page.locator("[data-menu-stop]").first().click(); await page.waitForTimeout(1900);
    const d = await page.evaluate(() => { const rib = document.querySelector("[data-deck-stop] > div"); if (!rib) return null; const r = rib.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const top = document.elementFromPoint(cx, cy);
      const zoom = document.querySelector('[aria-label="Фото на весь экран"]'), zr = zoom ? zoom.getBoundingClientRect() : null;
      return { text: rib.textContent, onTop: !!top && (top === rib || rib.contains(top) || top.closest("[data-deck-stop]") !== null || getComputedStyle(rib.parentElement).pointerEvents === "none"), hit: top ? (top.tagName + "." + (top.className || "")).slice(0, 60) : "", bg: getComputedStyle(rib).backgroundColor, left: r.left, right: r.right, zoomLeft: zr ? zr.left : null, body: document.body.innerText.replace(/\s+/g, " ").slice(0, 400) }; });
    ok(`${tag}: нажатие на блюдо — «Колода меню» на нём (4/10), лента «СЕГОДНЯ НЕТ» есть`, !!d && /Колода меню/.test(d.body) && /4\/10/.test(d.body) && /Закуска из морепродуктов/.test(d.body) && d.text === "СЕГОДНЯ НЕТ", d && d.body);
    // лента поверх фото: её пиксели видны (красные) в точке, где раньше было фото
    const px = await page.evaluate(() => { const rib = document.querySelector("[data-deck-stop] > div"); const r = rib.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
    const png = await page.screenshot({ clip: { x: px.x - 2, y: px.y - 2, width: 4, height: 4 } });
    const col = await page.evaluate(async (b64) => { const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); const p = g.getImageData(1, 1, 1, 1).data; return [p[0], p[1], p[2]]; }, png.toString("base64"));
    ok(`${tag}: лента лежит поверх фото (в её середине — красный, а не фото) и не закрывает кнопку «фото на весь экран»`, col[0] > 140 && col[1] < 110 && col[2] < 110 && d.zoomLeft !== null && d.right < d.zoomLeft - 40, JSON.stringify([col, d.right, d.zoomLeft]));
    await shot(page, "stop-deck-" + (light ? "lt" : "dk"));
    // назад → колода из списка режимов начинается с первой карточки
    await page.locator('[aria-label="Вернуться"]').first().click(); await page.waitForTimeout(1300);
    await page.locator('[data-menu-mode="cards"]').click(); await page.waitForTimeout(1700);
    const b2 = await body(page);
    ok(`${tag}: колода из списка режимов — с первой карточки (1/10), а не с блюда из стоп-листа`, /Колода меню/.test(b2) && /1\/10/.test(b2), b2.slice(0, 200));
    ok(`${tag}: без ошибок в консоли`, !errs.length, errs.join(" | "));
    await ctx.close();
  }
});

// ── FRESH ──────────────────────────────────────────────────────────────────────────────
await run("FRESH", async () => {
  const { ctx, page, errs } = await open({ who: "maria", spy: true });
  await nav(page, "roleSelect"); await page.waitForTimeout(8500);
  const first = await rpcs(page, "menu_get");
  ok("FRESH: первый запуск за день — меню с сервера спросили один раз (тихая подгрузка дня), второго запроса от главной нет", first.length === 1, JSON.stringify(first));
  ok("FRESH: у руководителя на значке «Меню» — «2»", (await badgeText(page)) === "2", await badgeText(page));
  await reload(page, errs); await nav(page, "roleSelect", 1200);
  ok("FRESH: тот же день, запуск ещё раз: число сразу с телефона, запроса ещё не было (старт лёгкий)", (await badgeText(page)) === "2" && (await rpcs(page, "menu_get")).length === 0, JSON.stringify(await rpcs(page, "menu_get")));
  await page.waitForTimeout(8000);
  const second = await rpcs(page, "menu_get");
  ok("FRESH: через 6 с после запуска — одна сверка меню с сервером (не раньше 5,5 с)", second.length === 1 && second[0] >= 5500, JSON.stringify(second));
  await page.waitForTimeout(6000);
  ok("FRESH: пока копия свежая (5 минут) — запросов больше нет", (await rpcs(page, "menu_get")).length === 1, JSON.stringify(await rpcs(page, "menu_get")));
  // ушли в другой раздел и вернулись — запроса нет (копия свежая), число на месте
  await nav(page, "shift", 1500); await nav(page, "roleSelect", 2500);
  ok("FRESH: вернулись на главную — число на месте, лишнего запроса нет", (await badgeText(page)) === "2" && (await rpcs(page, "menu_get")).length === 1);
  // руководитель ставит третье блюдо в стоп из чата: число на главной под чатом меняется само
  await openChat(page);
  await page.locator("[data-chat-input]").fill("Тартар закончился"); await page.waitForTimeout(500);
  const sg = await page.locator('[data-chat-sg="stop"]').count();
  ok("FRESH: чат — подсказка «В стоп-лист»", sg === 1);
  await page.locator('[data-chat-sg="stop"]').click(); await page.waitForTimeout(800);
  const picks = await page.locator('[data-chat-stopsheet] [data-chat-pick^="dish:"]').evaluateAll((els) => els.map((e) => [e.getAttribute("data-chat-pick"), e.textContent.replace(/\s+/g, " ").trim().slice(0, 40)]));
  const free = picks.find((p) => !/морепродукт|крабом и страчател/i.test(p[1]));
  await page.locator(`[data-chat-pick="${free[0]}"]`).click(); await page.waitForTimeout(400);
  await page.locator("[data-chat-stopgo]").click(); await page.waitForTimeout(2600);
  const afterOn = await rpcs(page, "menu_get");
  ok("FRESH: карточка стоп-листа в чате — главная под чатом сразу сверила меню (ещё один menu_get)", afterOn.length === 2 && (await page.locator('[data-chat-card="stop"]').count()) >= 1, JSON.stringify(afterOn));
  ok("FRESH: число на значке (под чатом) — уже «3», без перезагрузки", (await badgeText(page)) === "3", await badgeText(page));
  await closeChat(page); await page.waitForTimeout(600);
  const a3 = await homeInfo(page);
  ok("FRESH: чат закрыт — на значке «3», диктору «Меню. В стопе 3 блюда»", !!a3.badge && a3.badge.t === "3" && a3.tool.aria === "Меню. В стопе 3 блюда", JSON.stringify([a3.badge, a3.tool]));
  await shot(page, "fresh-3");
  // «Вернуть в меню» на карточке — число возвращается
  await openChat(page);
  await page.locator('[data-chat-card="stop"]').last().locator("[data-chat-unstop]").click(); await page.waitForTimeout(2600);
  ok("FRESH: «Вернуть в меню» — снова сверка и на значке «2»", (await rpcs(page, "menu_get")).length === 3 && (await badgeText(page)) === "2", JSON.stringify([await rpcs(page, "menu_get"), await badgeText(page)]));
  // лента перечитана (чат закрыли и открыли) — те же карточки новым запросом не считаются
  await closeChat(page); await openChat(page); await page.waitForTimeout(1500); await closeChat(page);
  ok("FRESH: чат открыли ещё раз (карточки те же) — лишних запросов нет", (await rpcs(page, "menu_get")).length === 3, JSON.stringify(await rpcs(page, "menu_get")));
  // снова стоп — и официант после входа видит то же число
  await openChat(page);
  await page.locator("[data-chat-input]").fill("Тартар закончился"); await page.waitForTimeout(500);
  await page.locator('[data-chat-sg="stop"]').click(); await page.waitForTimeout(800);
  await page.locator(`[data-chat-pick="${free[0]}"]`).click(); await page.waitForTimeout(400);
  await page.locator("[data-chat-stopgo]").click(); await page.waitForTimeout(2600);
  await closeChat(page);
  ok("FRESH: руководитель снова поставил стоп — «3»", (await badgeText(page)) === "3");
  await switchWho(page, errs, "anna"); await nav(page, "roleSelect", 1200);
  await page.waitForTimeout(8000);
  const an = await homeInfo(page);
  ok("FRESH: официант зашёл — на значке «3» (копия сверена с сервером)", !!an.badge && an.badge.t === "3", JSON.stringify(an.badge));
  await openMenu(page);
  const chips = await page.locator("[data-menu-stop]").count();
  ok("FRESH: в «Меню» у официанта — три блюда в строке «Сегодня нет»", chips === 3 && (await page.locator('[data-menu-stops="3"]').count()) === 1, String(chips));
  await shot(page, "fresh-anna-menu");
  ok("FRESH: без ошибок в консоли", !errs.length, errs.join(" | "));
  await ctx.close();
});

// ── NARROW ─────────────────────────────────────────────────────────────────────────────
await run("NARROW", async () => {
  for (const [width, height] of [[320, 640], [360, 760]]) for (const light of [false, true]) {
    const tag = `NARROW ${width} px` + (light ? " (для чтения)" : "");
    const { ctx, page, errs } = await open({ who: "anna", light, width, height });
    await nav(page, "roleSelect"); await page.waitForTimeout(6500);
    await page.evaluate(() => { const t = document.querySelector("[data-home-tiles]"); if (t) t.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(400);
    const a = await homeInfo(page);
    ok(`${tag}: «Идёт» есть, подпись не обрезана; оттиск и жетон «2» на месте; вбок ничего не вылезает`, !!a.live && a.whenClip <= 0 && !!a.next && !!a.badge && a.badge.t === "2" && a.badge.box.y >= a.row.y - 0.6 && a.badge.box.r <= a.row.r + 0.6 && (await overflowX(page)) <= 0, JSON.stringify([a.whenText, a.whenClip, a.badge, a.row]));
    ok(`${tag}: ряд печатей — 13 px высотой (плитка из-за оттиска не подросла)`, !!a.sealsRow && Math.abs(a.sealsRow.h - 13) < 0.6, JSON.stringify(a.sealsRow));
    await shot(page, `narrow-${width}-` + (light ? "lt" : "dk"));
    ok(`${tag}: без ошибок в консоли`, !errs.length, errs.join(" | "));
    await ctx.close();
  }
});

await browser.close(); server.close();
console.log(`\nитого: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
