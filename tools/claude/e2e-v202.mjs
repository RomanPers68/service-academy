// e2e v202 (Доп. 527): живая проверка в смене. Демо целиком (tools/claude/demo-app/build.mjs): сервер демо отвечает, как
// этап 65 (lib/live-check.js); __demo_no65 = "1" — сервер без этапа 65.
//   ASK      — Анна, «Мои проверки»: допуск к залу (из четырёх), у пройденного модуля «Готов к живой проверке» → «Позвал на
//              проверку», «Отменить» и снова позвать;
//   REQ      — Мария: «Просят проверку» первыми в списке, касание — сразу проверка модуля; «Неудачный вопрос?» — отметка;
//              сохранила — просьба закрыта;
//   MENU     — у Анны «Меню заведения»: четыре вопроса о блюдах «menu#…», итог, «Что повторить» — блюда;
//   BRIEF    — «Брифинг смены»: блок «Проверка на брифинге» (на смене по графику), «Другой вопрос»; «Провести» — страницы
//              вопросов, пункты, «Записать ответ» → «Записано»; «Отправить команде» блок не уносит;
//   SUMMARY  — Мария: план «проверено из стольких», норму не меняет; Роман: норма 14 дней, отмеченные вопросы → редактор;
//   EDITOR   — Роман: «Отмечены проверяющими» → «Поправить» → сохранить (отметки сняты), свой вопрос, черновики ассистента;
//              в «Редакторе контента» — вход «Вопросы живой проверки»;
//   PRACTICE — Анна: «Повтори вслух» в «Работе над ошибками», «Назвал всё» — вопрос уходит; ссылка lc_me;
//   ADMIT    — Ксения (новичок): в «Первой неделе» допуск к залу; Мария: в «Новичках» строка допуска;
//   LCSUM    — ссылка из итога недели (lc_sum) — сразу «Сводка»;
//   NOSTAGE  — без этапа 65: у Анны кнопок «Готов…» нет; у Марии меню и отметок нет; брифинг пишется блицем «Брифинг».
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v202.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5711, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v202";
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
  // что уходит на сервер: тело brief_publish — проверить, что блок проверки на брифинге не уходит команде
  await page.evaluate(() => { window.__pub = []; const f0 = window.fetch; window.fetch = (u, i) => { if (String(u).includes("/rpc/brief_publish")) window.__pub.push(String((i && i.body) || "")); return f0(u, i); }; });
}
async function open({ who = "maria", no65 = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", w); if (n) localStorage.setItem("__demo_no65", "1"); localStorage.setItem("sa_lesson_cards", "1"); }, [who, no65]);
  await page.goto(URL0, { waitUntil: "load" });
  await prep(page);
  return { ctx, page, errs };
}
async function become(page, who) {
  await page.evaluate((w) => localStorage.setItem("__demo_who", w), who);
  await page.goto(URL0, { waitUntil: "load" });
  await prep(page);
}
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const go = async (page, g, wait = 2000) => { await page.evaluate((x) => window.dispatchEvent(new CustomEvent("sa-go", { detail: { go: x } })), g); await sleep(wait); };
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch (e) { /* */ } await sleep(150); } return null; };
const texts = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((x) => x.textContent.replace(/\s+/g, " ").trim()), sel);
const attrs = (page, sel, a) => page.evaluate(([s, k]) => [...document.querySelectorAll(s)].map((x) => x.getAttribute(k)), [sel, a]);
const view = (page) => page.evaluate(() => { const e = document.querySelector("[data-lc]"); return e ? e.getAttribute("data-lc") : null; });
const click = async (page, sel, wait = 500) => { await page.locator(sel).first().click(); await sleep(wait); };
const count = (page, sel) => page.locator(sel).count();
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const back = async (page, wait = 600) => { await page.locator("[data-lens=back]").first().click(); await sleep(wait); };
const run = async (key, fn) => { if (!want(key)) return; try { await fn(); } catch (e) { ok(key + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };
async function answer(page, plan) {
  const keys = [];
  for (let i = 0; i < plan.length; i++) {
    keys.push((await attrs(page, "[data-lc-key]", "data-lc-key"))[0]);
    await click(page, "[data-lc-reveal]", 200);
    const p = plan[i];
    if (p === "all") await click(page, "[data-lc-all]", 120);
    else if (p === "none") await click(page, "[data-lc-none]", 120);
    else for (let j = 0; j < p; j++) await click(page, `[data-lc-pt="${i}:${j}"]`, 100);
    await click(page, "[data-lc-next-q]", 250);
  }
  return keys;
}

// ── ASK … ADMIT, LCSUM: один телефон, сервер демо общий ─────────────────────────────────────────────────────────────
if (["ASK", "REQ", "MENU", "BRIEF", "SUMMARY", "EDITOR", "PRACTICE", "ADMIT", "LCSUM"].some(want)) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await run("ASK", async () => {
    await go(page, "lc_me", 2500);
    ok("ASK: «Мои проверки» — свои итоги", (await until(async () => (await view(page)) === "person")) === true, await view(page));
    const adm = await until(async () => (await attrs(page, "[data-lc-admit]", "data-lc-admit"))[0] || null);
    ok("ASK: допуск к залу у «Новичка»: «Аллергии» и «ЧП», из четырёх", !!adm && /^\d\/4$/.test(adm) && (await count(page, "[data-lc-admit-row]")) === 2, adm);
    const btn = await until(async () => (await texts(page, '[data-lc-ask="s0"]'))[0] || null);
    ok("ASK: у пройденного модуля «Готов к живой проверке»", btn === "Готов к живой проверке", btn);
    await shot(page, "1-mine");
    await click(page, '[data-lc-ask="s0"]', 1500);
    ok("ASK: позвал — «Позвал на проверку», сообщение про руководителя", !!(await until(async () => (await count(page, '[data-lc-ask-sent="s0"]')) === 1))
      && (await texts(page, "[data-lc-msg=info]")).join("").includes("руководитель увидит просьбу первой"), await texts(page, "[data-lc-msg]"));
    await click(page, '[data-lc-ask-cancel="s0"]', 1500);
    ok("ASK: «Отменить» — снова кнопка", !!(await until(async () => (await count(page, '[data-lc-ask="s0"]')) === 1)));
    await click(page, '[data-lc-ask="s0"]', 1500);
    ok("ASK: снова позвал", !!(await until(async () => (await count(page, '[data-lc-ask-sent="s0"]')) === 1)));
  });
  await become(page, "maria");
  await run("REQ", async () => {
    await nav(page, "liveCheck", 2500);
    const req = await until(async () => (await texts(page, '[data-lc-req="e-anna:s0"]'))[0] || null);
    ok("REQ: «Просят проверку» — Анна, «готов к проверке: «Психология первого дня»»", !!req && req.includes("готов к проверке: «Психология первого дня»"), req);
    const order = await page.evaluate(() => { const a = document.querySelector("[data-lc-requests]"), b = document.querySelector("[data-lc-today], [data-lc-ideas]"); return !!a && (!b || !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); });
    ok("REQ: просьбы — первыми в списке", order);
    await shot(page, "2-requests");
    await click(page, '[data-lc-req="e-anna:s0"]', 1800);
    ok("REQ: касание — сразу проверка модуля", (await until(async () => (await view(page)) === "module")) === true, await view(page));
    await click(page, "[data-lc-flag-q]", 300);
    await page.locator("[data-lc-flag-note]").fill("Пункты не из урока");
    await click(page, "[data-lc-flag-send]", 1000);
    ok("REQ: «Неудачный вопрос?» — «Отмечено: руководство увидит»", (await texts(page, "[data-lc-flagged]")).join("").includes("руководство увидит"), await texts(page, "[data-lc-flagged]"));
    await answer(page, [1, "all", "none", "all"]);
    await click(page, "[data-lc-save]", 1500);
    ok("REQ: сохранено, в итоге — про «Работу над ошибками» и другие вопросы на пересдаче", (await count(page, "[data-lc-result]")) === 1
      && (await page.evaluate(() => document.body.innerText)).includes("«Работе над ошибками»"));
    await click(page, "[data-lc-tomods]", 900);
    await back(page, 1800);
    ok("REQ: просьба закрыта — «Просят проверку» больше нет", !!(await until(async () => (await count(page, "[data-lc-requests]")) === 0 && (await view(page)) === "list")), await view(page));
  });
  await run("MENU", async () => {
    await click(page, '[data-lc-person="e-anna"]', 1800);
    const n = await until(async () => (await attrs(page, "[data-lc-menu]", "data-lc-menu"))[0] || null);
    ok("MENU: у Анны «Меню заведения» — вопросы о блюдах из меню", !!n && Number(n) >= 4, n);
    await click(page, "[data-lc-menu-start]", 700);
    const keys = await answer(page, ["all", 1, "all", "none"]);
    ok("MENU: четыре вопроса о блюдах «menu#…», разные", keys.length === 4 && new Set(keys).size === 4 && keys.every((k) => /^menu#[a-z0-9_-]+$/.test(k)), keys);
    const q = (await texts(page, "[data-lc-back-to]"))[0] || "";
    ok("MENU: вопрос — «Блюдо «…»: что в составе…»", /^1\. Блюдо «.+»: /.test(q), q);
    await shot(page, "3-menu");
    await click(page, "[data-lc-save]", 1500);
    const rep = await texts(page, "[data-lc-repeat] > div");
    ok("MENU: итог, «Что повторить» — блюда, «Следующего модуля» нет", (await count(page, "[data-lc-result]")) === 1 && rep.length === 2 && !(await count(page, "[data-lc-next]")), rep);
    await click(page, "[data-lc-tomods]", 1200);
    ok("MENU: «Последняя …» у меню", !!(await until(async () => /^Последняя \d\d\.\d\d: \d+%/.test((await texts(page, "[data-lc-menu-last]"))[0] || ""))), await texts(page, "[data-lc-menu-last]"));
    await back(page, 1200);
  });
  await run("BRIEF", async () => {
    await nav(page, "brief", 3500);
    const items = await until(async () => { const a = await attrs(page, "[data-brief-lc]", "data-brief-lc"); return a.length ? a : null; }, 10000);
    ok("BRIEF: «Проверка на брифинге» — двое-трое со смены", !!items && items.length >= 1 && items.length <= 3, items);
    const k0 = (await attrs(page, "[data-brief-lc-key]", "data-brief-lc-key"))[0];
    await click(page, "[data-brief-lc-swap]", 400);
    const k1 = (await attrs(page, "[data-brief-lc-key]", "data-brief-lc-key"))[0];
    ok("BRIEF: «Другой вопрос» — другой ключ", !!k0 && !!k1 && k0 !== k1, [k0, k1]);
    await page.locator('[data-brief-block="lc"]').scrollIntoViewIfNeeded();
    await shot(page, "4-brief-block");
    await click(page, "[data-brief-present]", 1200);
    for (let i = 0; i < 14 && !(await count(page, "[data-brief-lc-page]")); i++) await click(page, "[data-brief-next]", 250);
    ok("BRIEF: в «Провести» — страница вопроса человеку", (await count(page, "[data-brief-lc-page]")) === 1, await attrs(page, "[data-brief-page]", "data-brief-page"));
    await click(page, "[data-brief-lc-reveal]", 300);
    await click(page, '[data-brief-lc-pt="0"]', 200);
    await shot(page, "5-brief-page");
    await click(page, "[data-brief-lc-save]", 1500);
    const saved = await until(async () => (await texts(page, "[data-brief-lc-saved]"))[0] || null);
    ok("BRIEF: «Записать ответ» → «Записано: 1 из N»", !!saved && /^Записано: 1 из \d\.$/.test(saved), saved);
    await click(page, "[data-sa-back]", 600);
    await click(page, "[data-brief-publish]", 2000);
    const pub = await page.evaluate(() => window.__pub.join(" "));
    ok("BRIEF: «Отправить команде» — блока проверки в брифинге нет", pub.length > 0 && !/Проверка на брифинге|"lc:|brief-lc/.test(pub), pub.slice(0, 200));
    await back(page, 1200);
  });
  await run("SUMMARY", async () => {
    await nav(page, "liveCheck", 2200);
    await click(page, '[data-lc-tab="sum"]', 2000);
    const plan = await until(async () => (await attrs(page, "[data-lc-plan]", "data-lc-plan"))[0] || null);
    ok("SUMMARY: Мария — план «проверено из стольких», норму не меняет", !!plan && /^\d+\/\d+$/.test(plan) && !(await count(page, "[data-lc-plan-days]")), plan);
    const tot = (await texts(page, "[data-lc-sum-tot]"))[0] || "";
    ok("SUMMARY: «на брифинге 1» в итогах", tot.includes("на брифинге 1"), tot);
    await shot(page, "6-sum-maria");
    await become(page, "roman");
    await nav(page, "liveCheck", 2200);
    await click(page, '[data-lc-tab="sum"]', 2200);
    ok("SUMMARY: Роман — нормы 14, 30, 60, 90 дней", JSON.stringify(await attrs(page, "[data-lc-plan-day]", "data-lc-plan-day")) === JSON.stringify(["14", "30", "60", "90"]));
    await click(page, '[data-lc-plan-day="14"]', 1800);
    ok("SUMMARY: норма — «каждого раз в 14 дней»", !!(await until(async () => (await texts(page, "[data-lc-plan]")).join("").includes("каждого раз в 14 дней"))), await texts(page, "[data-lc-plan]"));
    const fl = await until(async () => (await attrs(page, "[data-lc-flags]", "data-lc-flags"))[0] || null);
    ok("SUMMARY: «Проверяющие отметили неудачные вопросы: 1»", fl === "1", fl);
    await shot(page, "7-sum-roman");
    await click(page, "[data-lc-flags-open]", 2000);
    ok("SUMMARY: «Открыть» — редактор вопросов", !!(await until(async () => (await attrs(page, "[data-lce]", "data-lce"))[0] === "list")));
  });
  await run("EDITOR", async () => {
    if ((await attrs(page, "[data-lce]", "data-lce"))[0] !== "list") await nav(page, "lcEditor", 2000);
    const f = await until(async () => (await attrs(page, "[data-lce-flag]", "data-lce-flag"))[0] || null);
    ok("EDITOR: «Отмечены проверяющими» — вопрос и пояснение Марии", !!f && (await texts(page, "[data-lce-flags]")).join("").includes("Мария Ким: Пункты не из урока"), await texts(page, "[data-lce-flags]"));
    await shot(page, "8-editor");
    await click(page, `[data-lce-fix="${f}"]`, 800);
    ok("EDITOR: «Поправить» — форма с вопросом и «В приложении: …»", (await attrs(page, "[data-lce]", "data-lce"))[0] === "edit" && (await count(page, "[data-lce-base]")) === 1);
    await page.locator("[data-lce-text]").fill("Что ты скажешь гостю, если блюда нет в наличии?");
    await click(page, "[data-lce-save]", 1500);
    ok("EDITOR: сохранено — «Отметки проверяющих с этого вопроса сняты»", !!(await until(async () => (await texts(page, "[data-lce-msg]")).join("").includes("Отметки проверяющих с этого вопроса сняты"))), await texts(page, "[data-lce-msg]"));
    ok("EDITOR: в модуле вопрос «поправлен»", (await texts(page, `[data-lce-q="${f}"]`)).join("").includes("поправлен"), await texts(page, `[data-lce-q="${f}"]`));
    await click(page, "[data-lce-new]", 600);
    await page.locator("[data-lce-text]").fill("Что сделать, если гость просит пересадить за другой стол?");
    await page.locator('[data-lce-pt="0"]').fill("Спросить, какой стол удобнее");
    await page.locator('[data-lce-pt="1"]').fill("Предупредить менеджера");
    await click(page, "[data-lce-save]", 1500);
    ok("EDITOR: свой вопрос — в списке модуля «свой вопрос»", !!(await until(async () => (await texts(page, "[data-lce-q]")).some((t) => t.includes("пересадить") && t.includes("свой вопрос")))));
    await click(page, "[data-lce-ai]", 2200);
    ok("EDITOR: «Ассистент предложит» — черновики", !!(await until(async () => (await count(page, "[data-lce-ai-q]")) >= 1)), await count(page, "[data-lce-ai-q]"));
    await back(page, 600); await back(page, 1200);
    await nav(page, "contentEditor", 1800);
    ok("EDITOR: в «Редакторе контента» — вход «Вопросы живой проверки»", (await count(page, "[data-ce-lc]")) === 1);
  });
  await run("PRACTICE", async () => {
    await become(page, "anna");
    await nav(page, "mistakes", 2500);
    const n = await until(async () => Number((await attrs(page, "[data-live-practice]", "data-live-practice"))[0] || 0) || null);
    ok("PRACTICE: «Повтори вслух» — вопросы, где Анна назвала не всё", !!n && n >= 2, n);
    await shot(page, "9-practice");
    const k = (await attrs(page, "[data-live-practice-q]", "data-live-practice-q"))[0];
    await click(page, `[data-live-practice-open="${k}"]`, 300);
    await click(page, `[data-live-practice-ok="${k}"]`, 600);
    ok("PRACTICE: «Назвал всё» — вопрос ушёл", (await attrs(page, "[data-live-practice-q]", "data-live-practice-q")).every((x) => x !== k)
      && Number((await attrs(page, "[data-live-practice]", "data-live-practice"))[0] || 0) === n - 1);
    await go(page, "lc_me", 2200);
    ok("PRACTICE: в «Моих проверках» — «Повторить вслух», «Открыть»", !!(await until(async () => (await count(page, "[data-lc-practice]")) === 1)));
  });
  await run("ADMIT", async () => {
    await become(page, "ksenia");
    await nav(page, "newbie", 2500);
    const a = await until(async () => (await attrs(page, "[data-nb-admit]", "data-nb-admit"))[0] || null);
    ok("ADMIT: Ксения — «Допуск к залу · 0 из 4»", a === "0/4" && (await texts(page, "[data-nb-admit]")).join("").includes("Допуск к залу · 0 из 4"), a);
    await page.locator("[data-nb-admit]").scrollIntoViewIfNeeded();
    await shot(page, "10-admit");
    await become(page, "maria");
    await nav(page, "newbies", 2500);
    const lines = await until(async () => { const t = await texts(page, "[data-nbl-admit]"); return t.length ? t : null; });
    ok("ADMIT: Мария — в «Новичках» строка «Допуск к залу: N из 4»", !!lines && lines.every((t) => /^Допуск к залу: \d из 4$|^Допущен\(а\) к залу$/.test(t)), lines);
  });
  await run("LCSUM", async () => {
    await go(page, "lc_sum", 2500);
    ok("LCSUM: ссылка итога недели — сразу «Сводка»", (await until(async () => (await view(page)) === "sum")) === true, await view(page));
  });
  ok("без ошибок страницы (ASK…LCSUM)", errs.length === 0, errs);
  await ctx.close();
}

// ── NOSTAGE: сервер без этапа 65 ──────────────────────────────────────────────────────────────────────────────────
await run("NOSTAGE", async () => {
  const { ctx, page, errs } = await open({ who: "anna", no65: true });
  await go(page, "lc_me", 2500);
  await until(async () => (await view(page)) === "person");
  await sleep(800);
  ok("NOSTAGE: у Анны кнопок «Готов к живой проверке» нет", (await count(page, "[data-lc-ask]")) === 0);
  await become(page, "maria");
  await nav(page, "liveCheck", 2200);
  await click(page, '[data-lc-person="e-anna"]', 1800);
  ok("NOSTAGE: у Марии «Меню заведения» нет", (await count(page, "[data-lc-menu]")) === 0);
  await click(page, '[data-lc-module="s0"]', 700);
  await click(page, "[data-lc-reveal]", 200);
  ok("NOSTAGE: «Неудачный вопрос?» нет", (await count(page, "[data-lc-flag-q]")) === 0);
  await back(page, 300); await back(page, 1200);
  await nav(page, "brief", 3500);
  const items = await until(async () => { const a = await attrs(page, "[data-brief-lc-key]", "data-brief-lc-key"); return a.length ? a : null; }, 10000);
  ok("NOSTAGE: брифинг — только вопросы по урокам", !!items && items.every((k) => !/^menu#/.test(k)), items);
  await click(page, "[data-brief-present]", 1200);
  for (let i = 0; i < 14 && !(await count(page, "[data-brief-lc-page]")); i++) await click(page, "[data-brief-next]", 250);
  await click(page, "[data-brief-lc-reveal]", 300);
  await click(page, '[data-brief-lc-pt="0"]', 200);
  await click(page, "[data-brief-lc-save]", 1500);
  ok("NOSTAGE: ответ на брифинге записан (блицем «Брифинг»)", !!(await until(async () => /^Записано: 1 из \d\.$/.test((await texts(page, "[data-brief-lc-saved]"))[0] || ""))), await texts(page, "[data-brief-lc-saved]"));
  ok("NOSTAGE: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

await browser.close();
server.close();
console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
process.exit(fail ? 1 : 0);
