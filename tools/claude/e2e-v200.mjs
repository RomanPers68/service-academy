// e2e v200 (Доп. 525): живая проверка по урокам. Демо целиком (tools/claude/demo-app/build.mjs): сервер демо отвечает,
// как этап 63 (lib/live-check.js); __demo_no63 = "1" — сервер без этапа 63.
//   CHECK  — Мария (менеджер): в «Команде» плитка «Живая проверка»; в списке те, кто ниже менеджера в её заведении
//            (Анна, Ольга, Илья…), без владельца; Анна → курсы «Новичок» и «Ядро», модули с тем, что пройдено в
//            приложении; модуль «Психология первого дня» → 4 вопроса, у каждого «Что должно прозвучать» и три отметки;
//            «Сохранить» недоступна, пока не отмечены все; 2, 2, 1, 2 → «Сохранить · 88%» → «Зачтено», «Что повторить» —
//            урок вопроса с «частично»; в списке модулей — «зачтено 88%»; «Убрать проверку» убирает;
//   OWNER  — Роман (владелец): в списке есть Мария (менеджер); проверка Марии по модулю менеджера сохраняется;
//            «Заведения и должности» — «Управляющий»: «как менеджер · старше менеджера», переключатель в правке;
//   REPORT — Мария: отчёт по Анне (список и карточка подставлены в странице) — «Живая проверка», «Проверить вживую»
//            сразу открывает Анну; после проверки назад — снова её карточка, в разделе модуль «зачтено, 100%»;
//   STAFF  — Анна (официант): плитки нет; экран — «Проверяют руководители…»;
//   NOSTAGE — без этапа 63: у владельца — «после этапа базы 63».
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v200.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5700, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v200";
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

async function open({ who = "maria", no63 = false, dsf = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", w); if (n) localStorage.setItem("__demo_no63", "1"); localStorage.setItem("sa_lesson_cards", "1"); }, [who, no63]);
  await page.goto(URL0, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await sleep(1300);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg,#demo-strip,#demo-tgchat,#demo-push{display:none!important}" });
  return { ctx, page, errs };
}
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch (e) { /* */ } await sleep(150); } return null; };
const texts = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((x) => x.textContent.replace(/\s+/g, " ").trim()), sel);
const attrs = (page, sel, a) => page.evaluate(([s, k]) => [...document.querySelectorAll(s)].map((x) => x.getAttribute(k)), [sel, a]);
const body = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const click = async (page, sel, wait = 600) => { await page.locator(sel).first().click(); await sleep(wait); };
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const run = async (key, fn) => { if (!want(key)) return; try { await fn(); } catch (e) { ok(key + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };
const tile = (page) => page.evaluate(() => [...document.querySelectorAll("button, [role=button]")].some((x) => /Живая проверка/.test(x.textContent)));

// ── CHECK: менеджер проверяет официанта ────────────────────────────────────────────────────────────────────────────
await run("CHECK", async () => {
  const { ctx, page, errs } = await open({ dsf: 3 });
  await nav(page, "teamHub", 1800);
  ok("CHECK: в «Команде» у менеджера — плитка «Живая проверка»", await tile(page));
  await nav(page, "liveCheck", 2000);
  const ids = await until(async () => { const a = await attrs(page, "[data-lc-person]", "data-lc-person"); return a.length ? a : null; });
  ok("CHECK: в списке — ниже менеджера в её заведении (Анна, Ольга, Илья), владельца и самой Марии нет",
    !!ids && ["e-anna", "e-olga", "e-ilya"].every((x) => ids.includes(x)) && !ids.includes("u-roman") && !ids.includes("u-maria"), ids);
  ok("CHECK: строка Анны — должность и «ещё не проверяли»", (await texts(page, '[data-lc-person="e-anna"]'))[0].includes("ещё не проверяли"), await texts(page, '[data-lc-person="e-anna"]'));
  await shot(page, "1-list");
  await click(page, '[data-lc-person="e-anna"]', 1500);
  ok("CHECK: Анна — курсы «Новичок» и «Ядро», выбран «Новичок»", JSON.stringify(await attrs(page, "[data-lc-track]", "data-lc-track")) === JSON.stringify(["seasonal", "core"])
    && (await attrs(page, '[data-lc-track][aria-pressed="true"]', "data-lc-track"))[0] === "seasonal", await attrs(page, "[data-lc-track]", "data-lc-track"));
  const m0 = (await texts(page, '[data-lc-module="s0"]'))[0] || "";
  ok("CHECK: модуль «Психология первого дня» — что пройдено в приложении и «Проверить»", /в приложении (пройден|уроков|не начат)/.test(m0) && m0.includes("Проверить"), m0);
  await shot(page, "2-person");
  await click(page, '[data-lc-module="s0"]', 900);
  ok("CHECK: модуль — 4 вопроса, у каждого «Что должно прозвучать» и три отметки",
    (await page.locator("[data-lc-q]").count()) === 4 && (await page.locator("[data-lc-mark]").count()) === 12 && (await body(page)).includes("Что должно прозвучать"));
  ok("CHECK: «Сохранить» приглушена, пока не отмечены все", (await page.locator("[data-lc-save]").evaluate((b) => getComputedStyle(b).opacity)) === "0.55");
  for (const [i, v] of [[0, 2], [1, 2], [2, 1], [3, 2]]) await click(page, `[data-lc-mark="${i}:${v}"]`, 200);
  ok("CHECK: отметки 2, 2, 1, 2 — на кнопке «Сохранить · 88%»", (await texts(page, "[data-lc-save]"))[0] === "Сохранить · 88%", await texts(page, "[data-lc-save]"));
  await page.locator("[data-lc-note]").fill("Хорошо помнит стоп-лист");
  await shot(page, "3-module");
  await click(page, "[data-lc-save]", 1500);
  ok("CHECK: итог — «88%», «Зачтено»", (await attrs(page, "[data-lc-result]", "data-lc-result"))[0] === "pass" && (await body(page)).includes("88%"));
  ok("CHECK: «Что повторить» — урок вопроса с «частично» («Shadow и первые шаги»)", (await texts(page, "[data-lc-repeat]"))[0] === "Shadow и первые шаги", await texts(page, "[data-lc-repeat]"));
  await shot(page, "4-result");
  await click(page, "[data-lc-tomods]", 1200);
  ok("CHECK: в модулях — «зачтено 88%» у «Психологии первого дня»", !!(await until(async () => (await attrs(page, '[data-lc-module="s0"]', "data-lc-res"))[0] === "88"))
    && (await texts(page, '[data-lc-module="s0"] [data-lc-chip]'))[0] === "зачтено 88%", await texts(page, '[data-lc-module="s0"]'));
  ok("CHECK: итог по курсу — «Зачтено модулей: 1 из 14»", (await attrs(page, "[data-lc-sum]", "data-lc-sum"))[0] === "1/14", await attrs(page, "[data-lc-sum]", "data-lc-sum"));
  // убрать ошибочную
  await click(page, '[data-lc-module="s1"]', 800);
  for (const i of [0, 1, 2, 3]) await click(page, `[data-lc-mark="${i}:0"]`, 150);
  await click(page, "[data-lc-save]", 1400);
  ok("CHECK: 0, 0, 0, 0 — «Не зачтено», 0%", (await attrs(page, "[data-lc-result]", "data-lc-result"))[0] === "fail" && (await body(page)).includes("0%"));
  await click(page, "[data-lc-undo]", 1300);
  ok("CHECK: «Убрать проверку» — убрана, у модуля снова «Проверить»", !!(await until(async () => (await attrs(page, '[data-lc-module="s1"]', "data-lc-res"))[0] === ""))
    && (await texts(page, "[data-lc-msg=info]")).join("").startsWith("Проверка убрана"));
  await page.locator("[data-lens=back]").first().click(); await sleep(1200);
  ok("CHECK: назад — список, у Анны «зачтено 1 модуль из 1»", !!(await until(async () => ((await texts(page, '[data-lc-person="e-anna"]'))[0] || "").includes("зачтено 1 модуль из 1"))), await texts(page, '[data-lc-person="e-anna"]'));
  ok("CHECK: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── OWNER: владелец проверяет менеджера; «Управляющий» старше менеджера ─────────────────────────────────────────────
await run("OWNER", async () => {
  const { ctx, page, errs } = await open({ who: "roman" });
  await nav(page, "liveCheck", 2000);
  const ids = await until(async () => { const a = await attrs(page, "[data-lc-person]", "data-lc-person"); return a.length ? a : null; });
  ok("OWNER: в списке владельца есть Мария (менеджер), первой — по ступени", !!ids && ids[0] === "u-maria", ids);
  await click(page, '[data-lc-person="u-maria"]', 1500);
  ok("OWNER: у Марии курс «Менеджер»", (await attrs(page, '[data-lc-track][aria-pressed="true"]', "data-lc-track"))[0] === "manager");
  await click(page, '[data-lc-module="m0"]', 800);
  const n = await page.locator("[data-lc-q]").count();
  for (let i = 0; i < n; i++) await click(page, `[data-lc-mark="${i}:2"]`, 120);
  await click(page, "[data-lc-save]", 1400);
  ok("OWNER: проверка Марии сохранена — 100%, «Зачтено», повторять нечего", (await attrs(page, "[data-lc-result]", "data-lc-result"))[0] === "pass" && !(await page.locator("[data-lc-repeat]").count()));
  await nav(page, "team", 2000);
  await click(page, "[data-team-org]", 1200);
  const row = await until(async () => (await texts(page, "[data-org-list=position] > div")).find((t) => t.includes("Управляющий")) || null);
  ok("OWNER: «Заведения и должности» — «Управляющий · как менеджер · старше менеджера»", !!row && row.includes("как менеджер · старше менеджера"), row);
  await click(page, '[data-org-rename="pupravl00"]', 700);
  ok("OWNER: в правке «Управляющего» — переключатель «Старше менеджера», включён", (await attrs(page, '[data-org-up="pupravl00"]', "aria-pressed"))[0] === "true");
  await click(page, '[data-org-up="pupravl00"]', 900);
  ok("OWNER: сняли — «на одной ступени с менеджером», в строке «старше» нет",
    (await texts(page, "[data-org-msg=ok]"))[0] === "«Управляющий» теперь на одной ступени с менеджером." && (await attrs(page, '[data-org-up="pupravl00"]', "aria-pressed"))[0] === "false",
    await texts(page, "[data-org-msg]"));
  await shot(page, "5-org");
  ok("OWNER: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── REPORT: отчёт по сотруднику — раздел «Живая проверка» и «Проверить вживую» ────────────────────────────────────────
await run("REPORT", async () => {
  const { ctx, page, errs } = await open();
  // отчётов в сервере демо нет: список и карточку подставляем в странице (как report_people и report_person этапа 23)
  await page.evaluate(() => { const f0 = window.fetch; const now = new Date().toISOString();
    const P = { "e-anna": ["Анна", "Смирнова"], "e-petr": ["Пётр", "Орлов"] };
    const json = (x) => new Response(JSON.stringify(x), { status: 200, headers: { "Content-Type": "application/json" } });
    window.fetch = async (u, init) => {
      const s = String(u);
      if (s.includes("/rpc/report_people")) return json({ ok: true, scope: "restaurant", restaurant: "Два моря, Океан",
        rows: Object.entries(P).map(([id, [name, surname]]) => ({ id, name, surname, restaurant: "Два моря, Океан", position: "waiter", last_role: "seasonal", seen: now, lessons: 4, quiz: 1 })) });
      if (s.includes("/rpc/report_person")) { const id = JSON.parse(init.body).p_emp, [name, surname] = P[id] || ["?", ""];
        return json({ ok: true, data: { person: { id, name, surname, restaurant: "Два моря, Океан", position: "waiter" }, last_role: "seasonal", lessons: ["s0-1", "s0-2", "s0-3", "s0-4"], quiz: ["s0-q"], scores: [] } }); }
      return f0(u, init);
    }; });
  await nav(page, "report", 2200);
  await page.locator(".rp .rp-row", { hasText: "Анна Смирнова" }).first().click(); await sleep(1500);
  ok("REPORT: в карточке Анны — «Живая проверка»: ещё не проверяли, кнопка «Проверить вживую»",
    !!(await until(async () => (await attrs(page, "[data-rp-live]", "data-rp-live"))[0] === "0")) && (await texts(page, "[data-rp-live]"))[0].includes("Вживую по урокам ещё не проверяли.")
    && (await page.locator("[data-rp-live-go]").count()) === 1, await texts(page, "[data-rp-live]"));
  await click(page, "[data-rp-live-go]", 1800);
  ok("REPORT: «Проверить вживую» — сразу Анна в живой проверке", !!(await until(async () => (await attrs(page, "[data-lc]", "data-lc"))[0] === "person"))
    && (await texts(page, '[data-lc-track][aria-pressed="true"]'))[0] === "Новичок");
  await click(page, '[data-lc-module="s0"]', 800);
  for (const i of [0, 1, 2, 3]) await click(page, `[data-lc-mark="${i}:2"]`, 150);
  await click(page, "[data-lc-save]", 1400);
  ok("REPORT: модуль зачтён, 100%", (await attrs(page, "[data-lc-result]", "data-lc-result"))[0] === "pass" && (await body(page)).includes("100%"));
  await page.locator("[data-lens=back]").first().click(); await sleep(900);
  ok("REPORT: назад — модули Анны", (await attrs(page, "[data-lc]", "data-lc"))[0] === "person");
  await page.locator("[data-lens=back]").first().click(); await sleep(2000);
  const row = await until(async () => (await texts(page, '[data-rp-live-row="s0"]'))[0] || null);
  ok("REPORT: ещё назад — снова карточка Анны в отчёте, в разделе «Психология первого дня · зачтено, 100%»",
    !!row && row.startsWith("Психология первого дня · зачтено, 100%") && (await attrs(page, "[data-rp-live]", "data-rp-live"))[0] === "1", row);
  await page.locator("[data-rp-live]").first().scrollIntoViewIfNeeded().catch(() => {}); await sleep(400);
  await shot(page, "7-report");
  ok("REPORT: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── STAFF: официант ────────────────────────────────────────────────────────────────────────────────────────────────
await run("STAFF", async () => {
  const { ctx, page, errs } = await open({ who: "anna" });
  await nav(page, "teamHub", 1800);
  ok("STAFF: у Анны плитки «Живая проверка» нет", !(await tile(page)));
  await nav(page, "liveCheck", 1800);
  ok("STAFF: экран — «Проверяют руководители…»", !!(await until(async () => (await texts(page, "[data-lc-msg=forbidden]")).join("").startsWith("Проверяют руководители"))));
  ok("STAFF: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── NOSTAGE: сервер без этапа 63 ──────────────────────────────────────────────────────────────────────────────────
await run("NOSTAGE", async () => {
  const { ctx, page, errs } = await open({ who: "roman", no63: true });
  await nav(page, "liveCheck", 1800);
  ok("NOSTAGE: у владельца — «заработает после этапа базы 63»", !!(await until(async () => (await texts(page, "[data-lc-msg=stage]")).join("").includes("после этапа базы 63"))));
  await shot(page, "6-nostage");
  ok("NOSTAGE: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

await browser.close();
server.close();
console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
process.exit(fail ? 1 : 0);
