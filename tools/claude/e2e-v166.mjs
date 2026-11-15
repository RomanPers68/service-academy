// e2e v166 (Доп. 491): «Бог сервиса» — все тесты всех шести треков на 100%: венок в рейтинге.
// Сайт — демо целиком (tools/claude/demo-app/build.mjs). Результаты команды подменяются в странице по флагу
// sessionStorage.__e2e_god (ответ team_scores сервера демо): у Веры — все тесты программы шести треков на 100%, у Петра —
// все тесты четырёх ступеней зала на 100%, без «Бара» и «Хостес» (до v166 этого хватало с запасом). Виды флага:
//   all    — как описано;
//   low    — у Веры один тест бара сдан на 92%;
//   retake — у Веры тот же тест сдан дважды: 92% и потом 100% (в счёт идёт лучшая попытка);
//   nospg  — у Веры нет ни одного теста «Хостес».
// Список тестов берётся из исходников (data/modules-index.js) — тот же, что видит приложение.
// Запуск: E2E_SITE=<демо> E2E_SRC=<исходники> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v166.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5660, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v166";
const SRC = process.env.E2E_SRC || new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
mkdirSync(OUT, { recursive: true });
const { MODULES_INDEX } = await import(SRC + "/data/modules-index.js");
const quizzes = (t) => MODULES_INDEX[t].filter((m) => !m.info).flatMap((m) => m.lessons.filter((l) => l.type === "quiz").map((l) => [l.id, t]));
const HALL = ["seasonal", "core", "manager", "service_manager"].flatMap(quizzes), SPG = quizzes("spg"), BAR = quizzes("bar");
const ALL = [...SPG, ...HALL, ...BAR];
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
const browser = await chromium.launch();

// в страницу до её кода: по флагу подменяем результаты команды
function inPage() {
  let flag = null; try { flag = JSON.parse(sessionStorage.getItem("__e2e_god") || "null"); } catch (e) { /* */ }
  if (!flag) return;
  let demo;
  try { Object.defineProperty(window, "__demo", { configurable: true, get() { return demo; }, set(v) { demo = v;
    const rpc = v.srv.rpc;
    v.srv.rpc = function (fn) {
      const r = rpc.apply(this, arguments);
      if (fn !== "team_scores" || !r || !r.ok || !Array.isArray(r.rows)) return r;
      const who = (name) => r.rows.find((x) => x.name === name);
      const vera = who("Вера"), petr = who("Пётр");
      if (!vera || !petr) return r;
      const at = new Date(Date.now() - 3600e3).toISOString();
      const mk = (base, id, track, score) => ({ ...base, id: undefined, quiz_id: id, role: track, score, total: 12, updated_at: at });
      const rest = r.rows.filter((x) => x.name !== "Вера" && x.name !== "Пётр");
      let v = flag.all.map(([id, t]) => mk(vera, id, t, 12));
      if (flag.mode === "low") v = v.map((x) => (x.quiz_id === "bar0-q" ? { ...x, score: 11 } : x));
      if (flag.mode === "retake") v = [mk(vera, "bar0-q", "bar", 11), ...v];
      if (flag.mode === "nospg") v = v.filter((x) => x.role !== "spg");
      const p = flag.hall.map(([id, t]) => mk(petr, id, t, 12));
      return { ...r, rows: [...rest, ...v, ...p] };
    }; } }); } catch (e) { /* */ }
}
async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.evaluate(() => { if (window.__e2eTidy) return; window.__e2eTidy = setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    document.querySelectorAll("[data-badge-new] [data-lens-x], [data-shelf-new] button[aria-label='Закрыть']").forEach((x) => x.click()); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" }).catch(() => {});
}
async function open(mode) {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  await ctx.addInitScript(inPage);
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([flag]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", "anna"); localStorage.setItem("__demo_pulse", "1");
    if (flag) sessionStorage.setItem("__e2e_god", JSON.stringify(flag)); }, [mode ? { mode, all: ALL, hall: HALL } : null]);
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs); await page.waitForTimeout(1300);
  await page.evaluate(() => window.__saNav("leaderboard")); await page.waitForTimeout(1700);
  return { ctx, page, errs };
}
// строки рейтинга: имя → есть ли венок «Бог сервиса», какие ещё значки
const rows = (page) => page.evaluate(() => { const out = {}; document.querySelectorAll("[data-lens-card]").forEach((c) => { const m = /(Вера|Пётр|Анна) [А-ЯЁ][а-яё]+/.exec(c.textContent || ""); if (!m || !c.querySelector("[data-lb-rank]")) return;
  out[m[1]] = { god: !!c.querySelector('span[title="Бог сервиса"]'), signs: [...c.querySelectorAll("span[title]")].map((s) => s.getAttribute("title")), text: (c.textContent || "").replace(/\s+/g, " ").slice(0, 80) }; }); return out; });

ok("список тестов из программы: зал " + HALL.length + ", «Хостес» " + SPG.length + ", «Бар» " + BAR.length, HALL.length >= 38 && SPG.length >= 11 && BAR.length >= 7 && ALL.length >= 56, ALL.length);
{
  const { ctx, page, errs } = await open("all");
  const r = await rows(page);
  ok("все " + ALL.length + " тестов шести треков на 100% — у Веры венок «Бог сервиса»", r["Вера"] && r["Вера"].god, r);
  ok("четыре ступени зала на 100%, без «Бара» и «Хостес» — у Петра венка нет (раньше был бы)", r["Пётр"] && !r["Пётр"].god, r["Пётр"]);
  ok("у Анны с одним тестом на 92% венка нет", r["Анна"] && !r["Анна"].god, r["Анна"]);
  await page.getByText("Вера Соколова").last().click(); await page.waitForTimeout(1100);
  const card = await page.evaluate(() => { const cap = document.querySelector("[data-lb-tests]"); return { n: cap ? cap.previousElementSibling.textContent : null, cap: cap ? cap.textContent : null, text: (document.body.innerText || "").replace(/\s+/g, " "),
    titles: [...document.querySelectorAll("[data-score-title]")].map((x) => x.textContent) }; });
  ok("карточка Веры: значок «Бог сервиса» подписан, «" + ALL.length + " тестов»", /Бог сервиса/.test(card.text) && card.n === String(ALL.length) && card.cap === "тестов", [card.n, card.cap]);
  ok("у каждого её результата видно название теста (не «Тест»)", card.titles.length === ALL.length && card.titles.every((t) => t && t !== "Тест"), card.titles.slice(0, 3));
  await page.screenshot({ path: join(OUT, "god-vera.png") });
  ok("без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
}
for (const [mode, want, name] of [["low", false, "один тест бара на 92% — венка нет"], ["retake", true, "тот же тест пересдан на 100% (в списке обе попытки) — венок есть: в счёт идёт лучшая"], ["nospg", false, "нет тестов «Хостес» — венка нет"]]) {
  const { ctx, page, errs } = await open(mode);
  const r = await rows(page);
  ok(name, r["Вера"] && r["Вера"].god === want, r["Вера"]);
  ok(mode + ": без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
}
{
  // обычное демо, без подмены: ни у кого нет всех тестов — венков нет, рейтинг как был
  const { ctx, page, errs } = await open(null);
  const r = await rows(page);
  ok("обычное демо: венка нет ни у кого, значки прежние", Object.keys(r).length >= 2 && Object.values(r).every((x) => !x.god), r);
  ok("обычное демо: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
}
console.log("\nитого: ✓ " + pass + (fail ? ", ✗ " + fail : ""));
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
