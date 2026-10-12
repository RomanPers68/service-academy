// e2e-loophole.mjs — сквозная проверка «Находчивой жопки» на настоящем тесте.
// node e2e-loophole.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const { chromium } = require(G + "/playwright");
const SRC = process.env.SRC || "/home/claude/work/service-academy";
const SITE = "/home/claude/preview/site", OUT = "/home/claude/preview/shots", PORT = 5210;

const spg = await import(SRC + "/data/modules-spg.js");
const quiz = Object.values(spg).flat().filter(x => x && x.lessons).flatMap(m => m.lessons).find(l => l.id === "spg-0-q");
const MAP = {}; for (const q of quiz.questions) MAP[q.q] = { right: q.options[q.correct], options: q.options };
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));

const prof = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "hostess", is_admin: false };
const UK = "_Анна_Смирнова";
const OKFN = new Set(["log_quiz_answer", "log_quiz_pick", "log_quiz_skip", "save_score", "save_quiz_done", "save_progress", "log_quiz_key", "quiz_key_rank"]);
// Место в тайном зачёте, как его вернул бы сервер (этап 16)
const RANK = { ok: true, mine: 1, leader: 3, players: 4, place: 2, tied: false };
const results = [];
const check = (name, cond, extra = "") => results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`);

async function run(name, body) {
  const browser = await chromium.launch();
  const seed = { sa_session_token: "preview", sa_profile: JSON.stringify(prof), sa_a11y: "0", sa_welcome_seen_v11: "1",
    sa_last_role: JSON.stringify("spg"), sa_hint_mistakes: "1" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: "block", locale: "ru-RU", timezoneId: "Europe/Moscow",
    ...(process.env.VIDEO ? { recordVideo: { dir: OUT + "/video", size: { width: 390, height: 844 } } } : {}) });
  const calls = [];
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m && OKFN.has(m[1])) { calls.push({ fn: m[1], body: JSON.parse(route.request().postData() || "{}") });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(/key/.test(m[1]) ? RANK : { ok: true }) }); }
    return route.abort();
  });
  await ctx.addInitScript((seed) => { if (localStorage.getItem("__seeded")) return; localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); localStorage.setItem("__seeded", "1"); }, seed);
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  const open = async () => { await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
    await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(600); };
  const clickText = async (t) => { const ok = await page.evaluate((t) => { const els = [...document.querySelectorAll("button, div, span")]
      .filter(e => e.offsetParent !== null && (e.innerText || "").trim() === t); const el = els[els.length - 1]; if (el) { el.click(); return true; } return false; }, t);
    await page.waitForTimeout(1200); return ok; };
  // Засчитывается ответ через 0,6 с (верный) или 1,4 с (неверный) — ждём дольше, если не сказано иное
  const answer = async (correct, wait) => { const r = await page.evaluate(({ MAP, correct }) => {
      const txt = document.body.innerText; const q = Object.keys(MAP).find(k => txt.includes(k)); if (!q) return { err: "нет вопроса" };
      const target = correct ? MAP[q].right : MAP[q].options.find(o => o !== MAP[q].right);
      const els = [...document.querySelectorAll("button, div, span")].filter(e => e.offsetParent !== null && (e.innerText || "").trim() === target);
      const el = els[els.length - 1]; if (!el) return { err: "нет варианта" }; el.click(); return { q }; }, { MAP, correct });
    await page.waitForTimeout(wait ?? (correct ? 900 : 1700)); return r; };
  const toTest = async () => { await page.evaluate(() => window.__saNav("home")); await page.waitForTimeout(1500);
    // v28 (Доп. 307): трек — меню тем; тема выбирается номером в оглавлении
    await page.evaluate(() => { const b = document.querySelector('.tbp-num[aria-label*="Знакомство"]'); if (b) b.click(); }); await page.waitForTimeout(800);
    return clickText("Тест: философия сервиса"); };
  const ls = (k) => page.evaluate((k) => localStorage.getItem(k), k);
  const passAll = async () => { for (let i = 0; i < 30; i++) { if (await page.evaluate(() => /Продолжить ✓/.test(document.body.innerText))) break; const r = await answer(true); if (r.err) break; } };
  try { await open(); await body({ page, calls, toTest, answer, clickText, ls, passAll, open }); }
  catch (e) { errors.push("сбой: " + e.message.split("\n")[0]); }
  check(`${name}: ошибок страницы нет`, errors.length === 0, errors.join(" | "));
  const vid = process.env.VIDEO ? page.video() : null;
  await ctx.close();
  if (vid) { const { renameSync } = await import("node:fs"); try { renameSync(await vid.path(), OUT + "/e2e-" + name + ".webm"); } catch (e) {} }
  await browser.close();
}

// ── 1. Лазейка ──────────────────────────────────────────────────────────────
await run("лазейка", async ({ page, calls, toTest, answer, clickText, ls, passAll, open }) => {
  check("тест открылся", await toTest());
  const a1 = await answer(true), a2 = await answer(false, 600);
  check("ответил верно и неверно", !a1.err && !a2.err, JSON.stringify([a1, a2]).slice(0, 80));
  await clickText("‹");
  const skip = JSON.parse(await ls("sa_qskip" + UK) || "{}")["spg-0-q"];
  check("выход записан на телефоне: 2 ответа, 1 ошибка", skip && skip.answered === 2 && skip.wrong.length === 1, JSON.stringify(skip || {}).slice(0, 90));
  const sent = calls.find(c => c.fn === "log_quiz_skip");
  check("выход отправлен на сервер", sent && sent.body.p_answered === 2 && sent.body.p_wrong.length === 1 && sent.body.p_wrong[0].r);
  check("выбранный и верный ответ отправлены (log_quiz_pick)", calls.filter(c => c.fn === "log_quiz_pick").length >= 2 && calls.some(c => c.fn === "log_quiz_pick" && c.body.p_right));
  check("тест снова открывается", await clickText("Тест: философия сервиса"));
  await passAll();
  await clickText("Продолжить ✓"); await page.waitForTimeout(1200);
  check("после сдачи сначала выезжает баннер, карточки ещё нет", await page.evaluate(() => /Тапни, чтобы посмотреть/.test(document.body.innerText) && !/Ах ты, хитрая жопка/.test(document.body.innerText)));
  const key = calls.find(c => c.fn === "log_quiz_key");
  check("ключ отправлен на сервер", key && key.body.p_lesson === "spg-0-q");
  await page.evaluate(() => { const b = document.querySelector('[aria-label^="Секретная ачивка. Тапни"]'); if (b) b.click(); });
  await page.waitForTimeout(1400);
  const card = await page.evaluate(() => document.body.innerText.includes("Ах ты, хитрая жопка") && document.body.innerText.includes("Находчивая жопка"));
  check("тап по баннеру — карточка «Находчивая жопка»", card);
  check("в карточке — тайный зачёт: «Ты хитр(ый|ая), но до первого места — ещё 3 ключа»", await page.evaluate(() => /Ты хитр(ый|ая), но до первого места — ещё 3 ключа/.test(document.body.innerText) && /2-е место из 4/.test(document.body.innerText)));
  await page.screenshot({ path: OUT + "/e2e-card.png" });
  check("родовые окончания по сотруднику: «ПОПАЛАСЬ», «ТЫ ОТВЕТИЛА»", await page.evaluate(() => {
    const t = document.body.innerText;
    return /ПОПАЛАСЬ/.test(t) && !/ПОПАЛСЯ/.test(t) && /ТЫ ОТВЕТИЛА/.test(t)
      && !/ты вышел|прошёл его|Ты хитрый|ты стёр,/.test(t) && /вышла|выходила/.test(t) && /Ты хитрая/.test(t); }));
  check("в карточке ошибка первой попытки, верный ответ и штамп", await page.evaluate(() => /ТЫ ОТВЕТИЛ/i.test(document.body.innerText) && /ВЕРНО/.test(document.body.innerText) && /ПОПАЛ(СЯ|АСЬ)/.test(document.body.innerText)));   // род — по сотруднику (правка 169)
  const qd = JSON.parse(await ls("sa_quiz_done" + UK) || "{}"); check("тест отмечен сданным", !!qd["spg-0-q"]);   // Доп. 286: ключ личный
  await clickText("Понятно");
  check("«Понятно» закрывает карточку", !(await page.evaluate(() => document.body.innerText.includes("Ах ты, хитрая жопка"))));
  await open(); await page.waitForTimeout(1500);
  check("после перезапуска ачивка не возвращается", !(await page.evaluate(() => /Ах ты, хитрая жопка|Тапни, чтобы посмотреть/.test(document.body.innerText))));
});

// ── 2. Честный провал: три ошибки → «Вернуться к урокам» → не лазейка ──────
await run("провал", async ({ page, calls, toTest, answer, clickText, ls, passAll }) => {
  check("тест открылся", await toTest());
  for (let i = 0; i < 3; i++) await answer(false);
  const blocked = await page.evaluate(() => /много ошибок/.test(document.body.innerText));
  check("после трёх ошибок тест прерван", blocked);
  await clickText("← Вернуться к урокам");
  check("провал не записан как выход", !JSON.parse(await ls("sa_qskip" + UK) || "{}")["spg-0-q"] && !calls.some(c => c.fn === "log_quiz_skip"));
  check("тест снова открывается", await clickText("Тест: философия сервиса"));
  await passAll(); await clickText("Продолжить ✓"); await page.waitForTimeout(800);
  check("после сдачи карточки нет", !(await page.evaluate(() => document.body.innerText.includes("Ах ты, хитрая жопка"))));
});

// ── 3. Баннер не тапнули: уехал сам — вернётся при следующем входе ────────
await run("баннер", async ({ page, toTest, answer, clickText, open }) => {
  check("тест открылся", await toTest());
  await answer(false, 600); await clickText("‹");
  await clickText("Тест: философия сервиса");
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => /Продолжить ✓/.test(document.body.innerText))) break; const r = await answer(true); if (r.err) break; }
  await clickText("Продолжить ✓"); await page.waitForTimeout(1200);
  check("баннер выехал", await page.evaluate(() => /Тапни, чтобы посмотреть/.test(document.body.innerText)));
  await page.waitForTimeout(13500);
  check("через 12 с баннер уехал сам", !(await page.evaluate(() => /Тапни, чтобы посмотреть/.test(document.body.innerText))));
  await open(); await page.waitForTimeout(2200);
  check("при следующем входе баннер вернулся", await page.evaluate(() => /Тапни, чтобы посмотреть/.test(document.body.innerText)));
});

// ── 4. Как у Романа: после сдачи баннер над экраном модуля → тап → «Разобрать ошибки» ──
await run("модуль", async ({ page, toTest, answer, clickText }) => {
  check("тест открылся", await toTest());
  await answer(false, 600); await clickText("‹");
  await clickText("Тест: философия сервиса");
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => /Продолжить ✓/.test(document.body.innerText))) break; const r = await answer(true); if (r.err) break; }
  await clickText("Продолжить ✓"); await page.waitForTimeout(1300);
  const under = await page.evaluate(() => (document.getElementById("root") || document.body).innerText.slice(0, 200));
  check("под баннером — экран модуля", /Знакомство|Тест: философия сервиса|Кто такая хостес/.test(under), under.slice(0, 60));
  await page.evaluate(() => { const b = document.querySelector('[aria-label^="Секретная ачивка. Тапни"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  const h = await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? Math.round(d.getBoundingClientRect().height) : 0; });
  check("карточка раскрылась нормальной высоты", h > 300, "высота " + h);
  await page.waitForTimeout(1200);
  check("карточка не схлопнулась сама через 2,5 с", await page.evaluate(() => !!document.querySelector('[role=dialog]')));
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Разобрать ошибки/.test(x.textContent)); if (b) b.click(); });
  await page.waitForTimeout(1600);
  const txt = await page.evaluate(() => document.body.innerText);
  check("«Разобрать ошибки» → «Работа над ошибками» открылась и стоит", /Работа над ошибками/.test(txt), txt.slice(0, 80).replace(/\s+/g, " "));
  await page.waitForTimeout(1500);
  check("через 1,5 с «Работа над ошибками» всё ещё на месте", await page.evaluate(() => /Работа над ошибками/.test(document.body.innerText)));
  await page.screenshot({ path: OUT + "/e2e-mistakes-after.png" });
});

console.log(results.join("\n"));
server.close();
