// e2e v201 (Доп. 526): живая проверка точнее и удобнее. Демо целиком (tools/claude/demo-app/build.mjs): сервер демо
// отвечает, как этап 64 (lib/live-check.js); __demo_no64 = "1" — сервер без этапа 64.
//   TODAY   — Мария: вкладки «Проверить» и «Сводка»; «Сегодня на смене» — Анна, «прошёл в приложении»; касание —
//             сразу проверка модуля: 4 вопроса «s0#…», разные, последний — ситуация; ответ скрыт, «Дальше» приглушена;
//   CHECK   — «Назвал всё», один пункт, «Назвал всё», «Ничего» → итог по пунктам, к вопросу из итога и обратно;
//             «Сохранить · N%» → итог, что повторить; вторая проверка модуля — другие четыре вопроса; «Убрать проверку»;
//   BLITZ   — «Блиц на 2 минуты»: три вопроса из пройденного → 100%, «Следующего модуля» нет, «Последний …: 100%»;
//   OFFLINE — нет связи: проверка ждёт на телефоне («уйдёт сама»), в списке «Ждут связи: 1 проверка»; связь вернулась —
//             «Отправили проверки, которые ждали связи: 1»;
//   SUMMARY — «Сводка»: проверок, зачтено, средний, по заведениям, кто проверял;
//   MINE    — Анна (тот же сервер демо): на «Смене» карточка итога, «Повторить», «Открыть урок»; «Мои проверки» —
//             свои итоги; после просмотра карточки нет; ссылка из бота lc_me — свои проверки;
//   NOSTAGE — без этапа 64 (Роман): проверка модуля уходит прежним вызовом; блиц и сводка — «после этапа базы 64».
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v201.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5710, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v201";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  const buf = readFileSync(f);
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream", "Content-Length": buf.length }); res.end(buf);
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 600) : "")); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

async function prep(page) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => {});
  await sleep(1300);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg,#demo-strip,#demo-tgchat,#demo-push{display:none!important}" });
}
async function open({ who = "maria", no64 = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", w); if (n) localStorage.setItem("__demo_no64", "1"); localStorage.setItem("sa_lesson_cards", "1"); }, [who, no64]);
  await page.goto(URL0, { waitUntil: "load" });
  await prep(page);
  return { ctx, page, errs };
}
// другой человек демо на том же телефоне: сервер демо остаётся (как в e2e-v158)
async function become(page, who) {
  await page.evaluate((w) => localStorage.setItem("__demo_who", w), who);
  await page.goto(URL0, { waitUntil: "load" });
  await prep(page);
}
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch (e) { /* */ } await sleep(150); } return null; };
const texts = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((x) => x.textContent.replace(/\s+/g, " ").trim()), sel);
const attrs = (page, sel, a) => page.evaluate(([s, k]) => [...document.querySelectorAll(s)].map((x) => x.getAttribute(k)), [sel, a]);
const view = (page) => page.evaluate(() => { const e = document.querySelector("[data-lc]"); return e ? e.getAttribute("data-lc") : null; });
const click = async (page, sel, wait = 500) => { await page.locator(sel).first().click(); await sleep(wait); };
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const run = async (key, fn) => { if (!want(key)) return; try { await fn(); } catch (e) { ok(key + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };
// пройти проверку: plan — для каждого вопроса "all" | "none" | число пунктов; возвращает ключи и сколько назвали
async function answer(page, plan) {
  const keys = [], got = [];
  for (let i = 0; i < plan.length; i++) {
    keys.push((await attrs(page, "[data-lc-key]", "data-lc-key"))[0]);
    await click(page, "[data-lc-reveal]", 200);
    const n = await page.locator("[data-lc-pt]").count();
    const p = plan[i];
    if (p === "all") await click(page, "[data-lc-all]", 120);
    else if (p === "none") await click(page, "[data-lc-none]", 120);
    else for (let j = 0; j < p; j++) await click(page, `[data-lc-pt="${i}:${j}"]`, 100);
    got.push([p === "all" ? n : p === "none" ? 0 : p, n]);
    await click(page, "[data-lc-next-q]", 250);
  }
  return { keys, got, score: Math.round((got.reduce((a, x) => a + x[0], 0) * 100) / got.reduce((a, x) => a + x[1], 0)) };
}

// ── TODAY, CHECK, BLITZ, OFFLINE, SUMMARY, MINE: один телефон, сервер демо общий ─────────────────────────────────────
if (want("TODAY") || want("CHECK") || want("BLITZ") || want("OFFLINE") || want("SUMMARY") || want("MINE")) {
  const { ctx, page, errs } = await open();
  let first = null;
  await run("TODAY", async () => {
    await nav(page, "liveCheck", 2500);
    ok("TODAY: вкладки «Проверить» и «Сводка»", JSON.stringify(await texts(page, "[data-lc-tab]")) === JSON.stringify(["Проверить", "Сводка"]), await texts(page, "[data-lc-tab]"));
    const anna = await until(async () => (await texts(page, '[data-lc-sug="e-anna"]'))[0] || null);
    ok("TODAY: «Сегодня на смене» — Анна: «прошёл в приложении: «Психология первого дня»»", !!(await page.locator("[data-lc-today]").count())
      && !!anna && anna.includes("прошёл в приложении: «Психология первого дня»"), anna);
    ok("TODAY: в общем списке у Анны «на смене»", (await page.locator('[data-lc-person="e-anna"] [data-lc-onshift]').count()) === 1);
    await shot(page, "1-today");
    await click(page, '[data-lc-sug="e-anna"]', 1800);
    ok("TODAY: касание — сразу проверка модуля «Психология первого дня»", (await until(async () => (await view(page)) === "module")) === true
      && (await page.evaluate(() => document.body.innerText)).includes("Психология первого дня"), await view(page));
    ok("TODAY: ответ скрыт: пунктов нет, «Показать, что должно прозвучать», «Дальше» приглушена",
      (await page.locator("[data-lc-pt]").count()) === 0 && (await page.locator("[data-lc-reveal]").count()) === 1
      && (await page.locator("[data-lc-next-q]").evaluate((b) => b.disabled && getComputedStyle(b).opacity === "0.55")));
    await shot(page, "2-question");
  });
  await run("CHECK", async () => {
    const r = await answer(page, ["all", 1, "all", "none"]);
    first = r.keys;
    ok("CHECK: четыре вопроса модуля, разные; последний — ситуация", r.keys.length === 4 && new Set(r.keys).size === 4 && r.keys.every((k) => /^s0#[1-8]$/.test(k))
      && (await texts(page, "[data-lc-back-to]"))[3].startsWith("4. Ситуация:"), [r.keys, await texts(page, "[data-lc-back-to]")]);
    ok("CHECK: итог по пунктам: «Сохранить · " + r.score + "%»", (await texts(page, "[data-lc-save]"))[0] === "Сохранить · " + r.score + "%"
      && (await attrs(page, "[data-lc-preview]", "data-lc-preview"))[0] === String(r.score), await texts(page, "[data-lc-save]"));
    await shot(page, "3-summary");
    await click(page, '[data-lc-back-to="1"]', 300);
    ok("CHECK: из итога — к вопросу 2, отмеченное на месте", (await attrs(page, "[data-lc-q]", "data-lc-q"))[0] === "1"
      && (await attrs(page, '[data-lc-pt][aria-pressed="true"]', "data-lc-pt")).join() === "1:0", await attrs(page, '[data-lc-pt][aria-pressed="true"]', "data-lc-pt"));
    await click(page, "[data-lc-next-q]", 200); await click(page, "[data-lc-next-q]", 200); await click(page, "[data-lc-next-q]", 300);
    await page.locator("[data-lc-note]").fill("Хорошо про стоп-лист");
    await click(page, "[data-lc-save]", 1500);
    const rep = await texts(page, "[data-lc-repeat] > div");
    ok("CHECK: итог " + r.score + "% и что повторить (вопросы, где назвали не всё)", (await page.evaluate(() => document.querySelector("[data-lc-result]").innerText)).includes(r.score + "%")
      && rep.length >= 1 && rep.length <= 2, rep);
    await shot(page, "4-result");
    await click(page, "[data-lc-tomods]", 1200);
    ok("CHECK: у модуля итог " + r.score + "%", !!(await until(async () => (await attrs(page, '[data-lc-module="s0"]', "data-lc-res"))[0] === String(r.score))));
    await click(page, '[data-lc-module="s0"]', 700);
    const r2 = await answer(page, ["all", "all", "all", "all"]);
    ok("CHECK: вторая проверка — другие четыре вопроса", r2.keys.every((k) => !first.includes(k)), [first, r2.keys]);
    await click(page, "[data-lc-save]", 1400);
    ok("CHECK: вторая — 100%, «Зачтено»", (await attrs(page, "[data-lc-result]", "data-lc-result"))[0] === "pass");
    await click(page, "[data-lc-undo]", 1300);
    ok("CHECK: «Убрать проверку» — снова прежний итог модуля " + r.score + "%", !!(await until(async () => (await attrs(page, '[data-lc-module="s0"]', "data-lc-res"))[0] === String(r.score))));
  });
  await run("BLITZ", async () => {
    await click(page, "[data-lc-blitz]", 700);
    ok("BLITZ: блиц — три вопроса", (await view(page)) === "blitz");
    const r = await answer(page, ["all", "all", "all"]);
    ok("BLITZ: ключи из пройденного (у Анны — «Психология первого дня»), разные", r.keys.length === 3 && new Set(r.keys).size === 3 && r.keys.every((k) => /^s0#/.test(k)), r.keys);
    await click(page, "[data-lc-save]", 1400);
    ok("BLITZ: 100%, «Зачтено», «Следующего модуля» нет", (await attrs(page, "[data-lc-result]", "data-lc-result"))[0] === "pass" && !(await page.locator("[data-lc-next]").count()));
    await click(page, "[data-lc-tomods]", 1200);
    ok("BLITZ: «Последний …: 100%»", !!(await until(async () => /^Последний \d\d\.\d\d: 100%$/.test((await texts(page, "[data-lc-blitz-last]"))[0] || ""))), await texts(page, "[data-lc-blitz-last]"));
  });
  await run("OFFLINE", async () => {
    await page.evaluate(() => { window.__lcOff = true; const f0 = window.fetch; window.fetch = (u, i) => (window.__lcOff && String(u).includes("/rpc/live_check_save") ? Promise.reject(new TypeError("Failed to fetch")) : f0(u, i)); });
    await click(page, '[data-lc-module="s1"]', 700);
    await answer(page, ["all", "all", 1, "all"]);
    await click(page, "[data-lc-save]", 1200);
    ok("OFFLINE: нет связи — итог посчитан, «уйдёт сама», «Убрать» нет", (await texts(page, "[data-lc-msg=queued]")).join("").includes("уйдёт сама") && !(await page.locator("[data-lc-undo]").count()));
    await shot(page, "5-offline");
    await page.locator("[data-lens=back]").first().click(); await sleep(400);
    await page.locator("[data-lens=back]").first().click(); await sleep(1500);
    ok("OFFLINE: в списке «Ждут связи: 1 проверка»", !!(await until(async () => (await texts(page, "[data-lc-msg=queued]")).join("").startsWith("Ждут связи: 1 проверка"))), await texts(page, "[data-lc-msg]"));
    await page.evaluate(() => { window.__lcOff = false; window.dispatchEvent(new Event("online")); }); await sleep(1500);
    ok("OFFLINE: связь вернулась — «Отправили проверки, которые ждали связи: 1.», очереди нет",
      !!(await until(async () => (await texts(page, "[data-lc-msg=info]")).join("") === "Отправили проверки, которые ждали связи: 1.")) && !(await page.locator("[data-lc-msg=queued]").count()), await texts(page, "[data-lc-msg]"));
  });
  await run("SUMMARY", async () => {
    await click(page, '[data-lc-tab="sum"]', 1800);
    const tot = await until(async () => (await texts(page, "[data-lc-sum-tot]"))[0] || null);
    ok("SUMMARY: итоги за 30 дней: проверок, зачтено, средний", !!tot && /Проверок: \d+, блицев 1/.test(tot) && /средний результат \d+%/.test(tot), tot);
    ok("SUMMARY: по заведениям — «Два моря, Океан», проверяла Мария Ким", (await texts(page, '[data-lc-sum-venue="Два моря, Океан"] [data-lc-sum-checkers]'))[0] === "Проверяли: Мария Ким 3",
      await texts(page, "[data-lc-sum-venue]"));
    await shot(page, "6-sum");
  });
  await run("MINE", async () => {
    await become(page, "anna");
    await nav(page, "shift", 2500);
    const card = await until(async () => (await texts(page, "[data-lc-mine]"))[0] || null);
    ok("MINE: у Анны на «Смене» карточка итога: «Мышление сервиса», процент, «Повторить», «Открыть урок»", !!card && card.includes("«Мышление сервиса»") && card.includes("Повторить:")
      && (await page.locator("[data-lc-mine-lesson]").count()) === 1, card);
    await shot(page, "7-mine-card");
    await click(page, "[data-lc-mine-open]", 2000);
    ok("MINE: «Мои проверки» — свои итоги, «проверяет руководитель»", (await view(page)) === "person" && (await attrs(page, "[data-lc-note-self]", "data-lc-note-self"))[0] === "1"
      && (await attrs(page, '[data-lc-module="s0"]', "data-lc-res"))[0] !== "", await view(page));
    await page.locator("[data-lens=back]").first().click(); await sleep(1200);
    await nav(page, "shift", 1500);
    ok("MINE: просмотренную карточку больше не показываем", !(await page.locator("[data-lc-mine]").count()));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("sa-go", { detail: { go: "lc_me" } }))); await sleep(2000);
    ok("MINE: ссылка из бота «Мои проверки» (lc_me) — свои итоги", (await view(page)) === "person" && (await attrs(page, "[data-lc-note-self]", "data-lc-note-self"))[0] === "1");
  });
  ok("без ошибок страницы (TODAY…MINE)", errs.length === 0, errs);
  await ctx.close();
}

// ── NOSTAGE: сервер без этапа 64 ──────────────────────────────────────────────────────────────────────────────────
await run("NOSTAGE", async () => {
  const { ctx, page, errs } = await open({ who: "roman", no64: true });
  await nav(page, "liveCheck", 2200);
  await click(page, '[data-lc-person="e-anna"]', 1500);
  await click(page, '[data-lc-module="s0"]', 700);
  const r = await answer(page, ["all", "all", "all", 1]);
  await click(page, "[data-lc-save]", 1400);
  ok("NOSTAGE: проверка модуля сохранена прежним вызовом (по отметкам)", (await view(page)) === "result" && !!(await page.locator("[data-lc-result]").count()), [await view(page), r.score]);
  await click(page, "[data-lc-tomods]", 1200);
  await click(page, "[data-lc-blitz]", 600);
  await answer(page, ["all", "all", "all"]);
  await click(page, "[data-lc-save]", 1200);
  ok("NOSTAGE: блиц — «заработают после этапа базы 64»", (await texts(page, "[data-lc-err]")).join("").includes("после этапа базы 64"), await texts(page, "[data-lc-err]"));
  await page.locator("[data-lens=back]").first().click(); await sleep(200);
  for (let i = 0; i < 4; i++) { if ((await view(page)) === "person") break; await page.locator("[data-lens=back]").first().click(); await sleep(250); }
  await page.locator("[data-lens=back]").first().click(); await sleep(1500);
  await click(page, '[data-lc-tab="sum"]', 1800);
  ok("NOSTAGE: сводка — «после этапа базы 64»", !!(await until(async () => (await texts(page, "[data-lc-msg=stage64]")).join("").includes("после этапа базы 64"))));
  ok("NOSTAGE: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

await browser.close();
server.close();
console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
process.exit(fail ? 1 : 0);
