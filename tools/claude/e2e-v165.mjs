// e2e v165 (Доп. 490): четыре находки с обхода приложения — приветствие, названия тестов, слово при числе, фото без рывка.
// Сайт — демо целиком (tools/claude/demo-app/build.mjs). Флаги сценария — в sessionStorage (их не стирает смена человека
// демо): __e2e_slow = "900,900,900" — задержка ответов с лицами (staff_photo), фото «О нас» (concept_photo) и фото чата
// (chat_photo). В страницу до её кода ставится хроника: каждые 30 мс — лица в кружках, фото «О нас» и фото в чате
// (есть ли, непрозрачность, идёт ли проявление).
// Разделы:
//   GREET — приветствие на телефонах 360…440 px: при любом приветствии и имени карандаш стоит в одной строке с именем
//           (не остаётся один на второй строке); где всё влезало в строку — по-прежнему строка; перенос не задевает
//           строку роли и название заведения; карандаш открывает «Аккаунт»; имя из двух слов; «Для чтения»;
//   TESTS — рейтинг: в карточке коллеги «1 тест» и название теста; «Моя статистика»: «Последние тесты» с названием,
//           карточка во всю ширину, полоска результата видна, «1 тест пройден»; у результата без даты — ни «Invalid
//           Date», ни точки перед пустотой; карточка сотрудника у руководителя (ответ сервера подставляется по флагу
//           __e2e_player): заголовком название теста, роль и дата в подписи;
//   WORDS — слово при числе в браузере: «Сборка · 3 шага» в «Колоде бармена» (все 55 карточек по порядку), «итог
//           месяца: 141 смена» в графике руководителя;
//   SOFT  — фото без рывка: лицо, приехавшее на открытый экран, проявляется поверх букв (сначала буквы, потом
//           полупрозрачное фото, потом стоит); при втором заходе и после перезапуска стоит сразу; то же у фото «О нас»
//           (пока едет — тихая подложка) и у фото в чате; при «меньше движения» — без анимации; без этапа 52 — буквы.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v165.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5650, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v165";
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
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 1200) : "")); } };
const browser = await chromium.launch();

// ── то, что ставится в страницу до её кода: задержки ответов с фото и хроника ───────────────────────────────
function inPage() {
  const flag = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const slow = (flag("__e2e_slow") || "").split(",").map(Number);
  const KIND = { staff_photo: 0, concept_photo: 1, chat_photo: 2 };
  window.__ph = { staff_photo: 0, concept_photo: 0, chat_photo: 0 };
  let cur = window.fetch;
  const wrap = (f) => function (input, init) {
    const u = typeof input === "string" ? input : (input && input.url) || "";
    const m = /\/rpc\/(staff_photo|concept_photo|chat_photo)(\?|$)/.exec(u);
    if (!m) return f.apply(this, arguments);
    window.__ph[m[1]]++;
    const ms = slow[KIND[m[1]]];
    if (!ms) return f.apply(this, arguments);
    return new Promise((res, rej) => setTimeout(() => { f.call(window, input, init).then(res, rej); }, ms));
  };
  try { Object.defineProperty(window, "fetch", { configurable: true, get() { return cur; }, set(v) { cur = wrap(v); } }); } catch (e) { /* */ }
  // карточка сотрудника: сервер демо её не отдаёт — по флагу отвечаем двумя результатами (известный тест с датой, неизвестный без)
  if (flag("__e2e_player")) {
    let demo;
    try { Object.defineProperty(window, "__demo", { configurable: true, get() { return demo; }, set(v) { demo = v;
      const rpc = v.srv.rpc;
      v.srv.rpc = function (fn) {
        if (fn === "player_detail") return { ok: true, progress: [], quiz: [{ quiz_id: "s0-q" }], scores: [
          { role: "seasonal", quiz_id: "s0-q", score: 12, total: 12, updated_at: new Date(Date.now() - 3600e3).toISOString() },
          { role: "seasonal", quiz_id: "нет-такого-теста", score: 9, total: 12 }] };
        return rpc.apply(this, arguments);
      }; } }); } catch (e) { /* */ }
  }
  // хроника: [есть ли фото, непрозрачность, идёт ли проявление, разобрано ли] по местам
  window.__log = []; const t0 = performance.now();
  const one = (i) => (i ? [Math.round(Number(getComputedStyle(i).opacity) * 100) / 100, i.classList.contains("sa-photo-in") ? 1 : 0, i.complete && i.naturalWidth > 0 ? 1 : 0] : null);
  setInterval(() => {
    const d = document;
    const faces = {}; d.querySelectorAll("[data-e2e-face]").forEach((c) => { faces[c.getAttribute("data-e2e-face")] = one(c.querySelector("img[data-face]")); });
    d.querySelectorAll("img[data-face]").forEach((i) => { const id = i.getAttribute("data-face"); if (!(id in faces)) faces[id] = one(i); });
    const cn = [...d.querySelectorAll("[data-cn-photo]")].map((f) => ({ id: f.getAttribute("data-cn-photo"), wait: f.querySelectorAll("[data-photo-wait]").length, img: one(f.querySelector("img")) }));
    const chat = [...d.querySelectorAll(".ch-ph[data-chat-photo]")].map((f) => ({ wait: f.querySelectorAll(".ch-ph-wait").length, img: one(f.querySelector("img")) }));
    const s = JSON.stringify({ faces, cn, chat }), L = window.__log;
    if (!L.length || L[L.length - 1].s !== s) L.push({ t: Math.round(performance.now() - t0), s });
  }, 30);
}
const takeLog = async (page) => (await page.evaluate(() => { const L = window.__log; window.__log = []; return L; })).map((x) => ({ t: x.t, ...JSON.parse(x.s) }));
const calls = (page) => page.evaluate(() => ({ ...window.__ph }));
// как фото появилось: seq — виды подряд (нет фото «-», невидимо «0», полупрозрачно «~», стоит «1»), soft — было
// полупрозрачным, cls — проявлялось классом .sa-photo-in, popped — встало непрозрачным в первом же кадре после «нет фото»
function fadeOf(log, pick) {
  const seq = []; let soft = false, cls = false, end = null, tIn = null, tSet = null;
  for (const row of log) {
    const v = pick(row); if (v === undefined) continue;
    const k = v === null ? "-" : v[0] <= 0.03 ? "0" : v[0] >= 0.97 ? "1" : "~";
    if (!seq.length || seq[seq.length - 1] !== k) seq.push(k);
    if (v) { if (k === "~") soft = true; if (v[1]) { cls = true; if (tIn === null) tIn = row.t; } else if (cls && tSet === null && k === "1") tSet = row.t; end = v; }
  }
  const s = seq.join("");
  return { seq: s, soft, cls, popped: /-1/.test(s), end, ms: tIn !== null && tSet !== null ? tSet - tIn : null };
}

async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.evaluate(() => { if (window.__e2eTidy) return; window.__e2eTidy = setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    document.querySelectorAll("[data-badge-new] [data-lens-x], [data-shelf-new] button[aria-label='Закрыть']").forEach((x) => x.click());
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" }).catch(() => {});
}
// flags — флаги сценария (sessionStorage); demo — флаги демо (localStorage: __demo_pulse, __demo_no52); фото на телефоне нет
async function open({ who = "anna", light = false, width = 440, height = 956, hour = 12, minute = 30, flags = {}, demo = {}, wait = 1300, reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka", reducedMotion: reduce ? "reduce" : "no-preference" });
  await ctx.addInitScript(inPage);
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, h, m, fl, dm]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", w);
    const real = performance.timeOrigin + performance.now(); const d = new Date();
    localStorage.setItem("__demo_t", JSON.stringify({ off: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).getTime() - real, at: real }));
    for (const k of Object.keys(dm)) localStorage.setItem(k, dm[k]);
    for (const k of Object.keys(fl)) sessionStorage.setItem(k, fl[k]); }, [who, hour, minute, flags, demo]);
  await page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase("sa_photos"); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs); await page.waitForTimeout(wait);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
// приложение закрыли и открыли на том же телефоне: память пуста, телефон (IndexedDB, localStorage) прежний
const relaunch = async (page, errs, wait = 900) => { await page.goto(URL0, { waitUntil: "load" }); await ready(page, errs); await page.waitForTimeout(wait); };
const nav = async (page, s, ms = 1600) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms); };
const overflowX = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });
const bodyText = (page) => page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " "));
const word = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };

// ═══ GREET: приветствие на телефонах ═════════════════════════════════════════════════════════════════
// Имя и приветствие подставляем в готовую разметку (в демо у людей короткие имена): вёрстка та же, что даёт приложение.
const HELLOS = ["Доброе утро", "Добрый вечер", "С возвращением"], NAMES = ["Анна", "Наталья", "Виктория", "Екатерина", "Александра"];
const greetState = (page, hello, name, head = "") => page.evaluate(({ hello, name, head }) => {
  const line = document.querySelector("[data-role-line]"); const greet = line && line.previousElementSibling; if (!greet) return null;
  const box = greet.firstElementChild, glue = box.querySelector("[data-greet-name]"); if (!glue) return { glue: false };
  const nameEl = glue.firstElementChild, pen = glue.lastElementChild;
  const tn = [...box.childNodes].filter((n) => n.nodeType === 3);
  tn.forEach((t, i) => { t.textContent = i === 0 ? hello : i === 1 ? ", " : ""; }); if (tn.length === 1) tn[0].textContent = hello + ", ";
  nameEl.textContent = name;
  let headEl = box.querySelector("[data-e2e-head]");
  if (head) { if (!headEl) { headEl = document.createElement("span"); headEl.setAttribute("data-e2e-head", ""); headEl.style.color = getComputedStyle(nameEl).color; box.insertBefore(headEl, glue); } headEl.textContent = head + " "; }
  else if (headEl) headEl.remove();
  const b = box.getBoundingClientRect(), n = nameEl.getBoundingClientRect(), p = pen.getBoundingClientRect(), l = line.getBoundingClientRect();
  const venue = greet.lastElementChild.firstElementChild.getBoundingClientRect(), hd = headEl && head ? headEl.getBoundingClientRect() : null;
  const mid = (r) => r.top + r.height / 2;
  return { glue: true, nowrap: getComputedStyle(glue).whiteSpace, lines: Math.round(b.height / 26), nameLow: n.top - b.top > 12, penSameLine: Math.abs(mid(p) - mid(n)) < 10, penAfter: p.left >= n.right - 0.5,
    penGap: Math.round(p.left - n.right), roleClear: l.top >= b.bottom - 1, venueTop: Math.abs(venue.top - b.top) < 12, venueClear: venue.left >= (n.top - b.top > 12 ? 0 : p.right) - 0.5, fitsRight: p.right <= b.right + 0.5,
    headLine1: hd ? hd.top - b.top < 12 : null, penSvg: !!pen.querySelector("svg") };
}, { hello, name, head });
if (want("GREET")) {
  const table = {};
  for (const W of [360, 375, 390, 393, 402, 412, 440]) {
    const { ctx, page, errs } = await open({ who: "anna", width: W, height: 852, hour: 19, minute: 30, wait: 900 });
    if (W === 393) {
      const st = await greetState(page, "Добрый вечер", "Анна");
      ok("GREET: имя и карандаш — в одной неразрывной обёртке", st && st.glue && st.nowrap === "nowrap" && st.penSvg, st);
    }
    const bad = [], rows = [];
    for (const hello of HELLOS) for (const name of NAMES) {
      const st = await greetState(page, hello, name);
      rows.push((st.lines < 2 ? "1" : st.nameLow ? "2" : "?"));
      if (!st.glue || !st.penSameLine || !st.penAfter || st.penGap > 12 || !st.roleClear || !st.venueTop || !st.venueClear || !st.fitsRight || st.lines > 2) bad.push([hello, name, st]);
    }
    table[W] = rows.join("");
    ok("GREET: " + W + " px — при любом приветствии и имени карандаш стоит сразу за именем, в его строке (" + rows.join("") + ")", bad.length === 0, bad.slice(0, 2));
    ok("GREET: " + W + " px — страница не шире экрана", (await overflowX(page)) <= 0);
    if (W === 393) {
      // «Добрый вечер, Александра»: имя встаёт в строку, карандашу места нет — раньше он уходил вниз один
      const a = await greetState(page, "Добрый вечер", "Александра");
      ok("GREET: 393 px, «Добрый вечер, Александра» — имя с карандашом перенеслись вместе, заведение осталось в первой строке", a.lines === 2 && a.nameLow && a.penSameLine && a.venueTop && a.roleClear, a);
      await shot(page, "greet-393-aleksandra");
      const e = await greetState(page, "Добрый вечер", "Екатерина");
      ok("GREET: 393 px, «Добрый вечер, Екатерина» — по-прежнему одна строка", e.lines === 1 && !e.nameLow && e.penSameLine, e);
      // имя из двух слов: первое остаётся в строке приветствия, второе уходит вниз вместе с карандашом
      const two = await greetState(page, "Добрый вечер", "Александра", "Анна");
      ok("GREET: 393 px, «Анна Александра» — «Анна» в первой строке, «Александра» с карандашом во второй", two.lines === 2 && two.headLine1 === true && two.nameLow && two.penSameLine && two.roleClear, two);
      await greetState(page, "Добрый вечер", "Анна");
      // карандаш в обёртке по-прежнему открывает профиль
      await page.locator("[data-greet-name] > span").last().click(); await page.waitForTimeout(1300);
      const prof = await page.evaluate(() => ({ greet: !!document.querySelector("[data-greet-name]"), text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 60) }));
      ok("GREET: карандаш открывает «Аккаунт» с именем", !prof.greet && /Аккаунт/.test(prof.text) && /Анна Смирнова/.test(prof.text), prof);
    }
    ok("GREET: " + W + " px — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
  ok("GREET: 440 px — всё в одну строку, как было", table[440] === "1".repeat(15), table[440]);
  ok("GREET: 360 px — «Доброе утро, Анна» в строку, длинные имена во второй строке вместе с карандашом", /^11222/.test(table[360]) && !/\?/.test(Object.values(table).join("")), table);
  {
    const { ctx, page, errs } = await open({ who: "anna", width: 393, height: 852, hour: 19, minute: 30, light: true, wait: 900 });
    const a = await greetState(page, "Добрый вечер", "Александра");
    ok("GREET: «Для чтения», 393 px — имя с карандашом вместе, строка роли не задета", a && a.glue && a.penSameLine && a.penAfter && a.roleClear && a.lines <= 2, a);
    await shot(page, "greet-393-light");
    ok("GREET: «Для чтения» — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
}

// ═══ TESTS: какой тест сдан ══════════════════════════════════════════════════════════════════════════
const personCard = async (page) => { await nav(page, "leaderboard"); await page.getByText("Вера Соколова").last().click(); await page.waitForTimeout(1100);
  return page.evaluate(() => { const cap = document.querySelector("[data-lb-tests]"); const t = document.querySelector("[data-score-title]"); const row = t ? t.parentElement.parentElement : null;
    return { cap: cap ? cap.textContent : null, n: cap ? cap.previousElementSibling.textContent : null, title: t ? t.textContent : null, sub: row ? row.children[1].textContent : null, text: (document.body.innerText || "").replace(/\s+/g, " ") }; }); };
const lastTest = async (page) => { await nav(page, "stats"); return page.evaluate(() => { const c = document.querySelector("[data-last-test]"); if (!c) return null; c.scrollIntoView({ block: "center" });
  const t = c.querySelector("[data-score-title]"), pct = t.nextElementSibling, sub = c.children[1], track = c.children[2], fill = track.firstElementChild;
  const cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect(), pr = pct.getBoundingClientRect(), kr = track.getBoundingClientRect(), fr = fill.getBoundingClientRect();
  return { n: document.querySelectorAll("[data-last-test]").length, title: t.textContent, pct: pct.textContent, sub: sub.textContent, w: Math.round(cr.width), titleLeft: Math.round(tr.left - cr.left), pctRight: Math.round(cr.right - pr.right),
    track: Math.round(kr.width), fill: Math.round(fr.width), text: (document.body.innerText || "").replace(/\s+/g, " ") }; }); };
if (want("TESTS")) {
  {
    const { ctx, page, errs } = await open({ who: "anna", demo: { __demo_pulse: "1" } });
    const c = await personCard(page);
    ok("TESTS: рейтинг, карточка коллеги — «1 тест», а не «1 тестов»", c.n === "1" && c.cap === "тест", [c.n, c.cap]);
    ok("TESTS: у результата видно название теста — «Тест: первый день»", c.title === "Тест: первый день", c.title);
    ok("TESTS: под названием — «12 из 12 верно» и дата", /^12 из 12 верно · \d{2}\.\d{2}\.\d{4}$/.test(c.sub || ""), c.sub);
    await shot(page, "tests-leaderboard");
    const s = await lastTest(page);
    ok("TESTS: «Моя статистика», «Последние тесты» — название теста, процент, роль и дата", s && s.n === 1 && s.title === "Тест: первый день" && s.pct === "92%" && /^Новичок · \d{2}\.\d{2}\.\d{4}$/.test(s.sub), s && [s.title, s.pct, s.sub]);
    ok("TESTS: карточка во всю ширину — название у левого края, процент у правого", s && s.titleLeft <= 22 && s.pctRight <= 22 && s.w > 300, s && [s.w, s.titleLeft, s.pctRight]);
    ok("TESTS: полоска результата видна и заполнена на 92%", s && s.track > s.w - 50 && Math.abs(s.fill / s.track - 0.92) < 0.02, s && [s.track, s.fill]);
    ok("TESTS: «1 тест пройден» у своей роли", s && /1 тест пройден(?!о)/.test(s.text) && !/1 тест пройдено/.test(s.text));
    await shot(page, "tests-stats");
    ok("TESTS: без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
  {
    // у результатов нет даты (так выглядит демо без «пульса»): ни «Invalid Date», ни точки перед пустотой
    const { ctx, page, errs } = await open({ who: "anna" });
    const c = await personCard(page);
    ok("TESTS: результат без даты в рейтинге — «12 из 12 верно», без точки и «Invalid Date»", c.sub === "12 из 12 верно" && !/Invalid Date/.test(c.text) && c.title === "Тест: первый день", [c.sub, c.title]);
    const s = await lastTest(page);
    ok("TESTS: результат без даты в статистике — «Новичок», без точки и «Invalid Date»", s && s.sub === "Новичок" && !/Invalid Date/.test(s.text) && s.title === "Тест: первый день", s && [s.sub, s.title]);
    ok("TESTS: без даты — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
  {
    // карточка сотрудника у руководителя («Моя статистика» → «Управление данными» → строка): заголовком название теста
    const { ctx, page, errs } = await open({ who: "roman", flags: { __e2e_player: "1" } });
    await nav(page, "stats", 1800);
    const row = page.getByText("Вера Соколова").last(); await row.scrollIntoViewIfNeeded(); await row.click(); await page.waitForTimeout(1600);
    const p = await page.evaluate(() => [...document.querySelectorAll("[data-player-test]")].map((c) => { const t = c.querySelector("[data-score-title]"), pct = t.nextElementSibling, sub = c.children[1], track = c.children[2], fill = track.firstElementChild;
      const cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect(), pr = pct.getBoundingClientRect();
      return { title: t.textContent, pct: pct.textContent, sub: sub.textContent, titleLeft: Math.round(tr.left - cr.left), pctRight: Math.round(cr.right - pr.right), w: Math.round(cr.width), track: Math.round(track.getBoundingClientRect().width), fill: Math.round(fill.getBoundingClientRect().width) }; }));
    ok("TESTS: карточка сотрудника — два результата, лучший первым", p.length === 2 && p[0].pct === "100%" && p[1].pct === "75%", p);
    ok("TESTS: у известного теста заголовок — название («Тест: первый день»), роль и дата — в подписи", p[0] && p[0].title === "Тест: первый день" && /^Новичок · 12 из 12 верно · \d{2}\.\d{2}\.\d{4}$/.test(p[0].sub), p[0]);
    ok("TESTS: у неизвестного теста без даты — «Тест», «Новичок · 9 из 12 верно», без «Invalid Date»", p[1] && p[1].title === "Тест" && p[1].sub === "Новичок · 9 из 12 верно" && !/Invalid Date/.test(await bodyText(page)), p[1]);
    ok("TESTS: карточки во всю ширину — название слева, процент справа, полоска видна", p.length === 2 && p.every((x) => x.titleLeft <= 22 && x.pctRight <= 22 && x.track > x.w - 50) && p[0].fill >= p[0].track - 2 && Math.abs(p[1].fill / p[1].track - 0.75) < 0.02, p);
    const roles = await page.evaluate(() => [...document.querySelectorAll("[data-player-role]")].map((c) => { const head = c.children[0], t = head.children[0], pct = head.children[1], track = c.children[1];
      const cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect(), pr = pct.getBoundingClientRect();
      return { id: c.getAttribute("data-player-role"), titleLeft: Math.round(tr.left - cr.left), pctRight: Math.round(cr.right - pr.right), gap: Math.round(pr.left - tr.right), w: Math.round(cr.width), track: Math.round(track.getBoundingClientRect().width) }; }));
    ok("TESTS: «Прогресс по ролям» в карточке сотрудника — название слева, процент справа (не слиплись), полоска во всю ширину", roles.length >= 6 && roles.every((x) => x.titleLeft <= 22 && x.pctRight <= 22 && x.gap > 60 && x.track > x.w - 50), roles.slice(0, 2));
    await shot(page, "tests-player");
    ok("TESTS: карточка сотрудника — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
}

// ═══ WORDS: слово при числе ══════════════════════════════════════════════════════════════════════════
if (want("WORDS")) {
  {
    const { ctx, page, errs } = await open({ who: "anna" });
    await nav(page, "cocktails", 1800);
    // карточки листаем по одной: после смены карточки кнопка «дальше» ненадолго занята анимацией
    const at = new Map(); let total = 0;
    for (let k = 0; k < 140; k++) {
      const t = await bodyText(page);
      const pos = /(\d+)\/(\d+) Колода/.exec(t), m = /Сборка · (\d+) (шаг[а-яё]*) · как в тренажёре/.exec(t);
      if (!pos) break;
      total = Number(pos[2]);
      if (m) at.set(pos[1], [Number(m[1]), m[2], m[0]]);
      if (Number(pos[1]) >= total) break;
      await page.getByText("дальше ›").first().click();
      const moved = await page.waitForFunction((was) => { const x = /(\d+)\/\d+ Колода/.exec((document.body.innerText || "").replace(/\s+/g, " ")); return !!x && x[1] !== was; }, pos[1], { timeout: 900 }).then(() => true, () => false);
      if (moved) await page.waitForTimeout(650);
    }
    const seen = [...at.values()].map((x) => x[0]), wrong = [...at.values()].filter((x) => x[1] !== word(x[0], "шаг", "шага", "шагов")).map((x) => x[2]);
    ok("WORDS: «Колода бармена» — у всех карточек со сборкой слово «шаг» стоит в форме своего числа (карточек " + seen.length + " из " + total + ")", seen.length >= 50 && seen.length <= total && wrong.length === 0, wrong.slice(0, 3));
    ok("WORDS: есть коктейли в три шага — «Сборка · 3 шага» (было «3 шагов»)", seen.filter((n) => n === 3).length >= 1, seen.join(","));
    ok("WORDS: колода — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await open({ who: "maria" });
    await nav(page, "schedule", 2200);
    const t = await bodyText(page);
    const tot = /итог месяца: (\d+) (смен[а-яё]*) ·/.exec(t), hint = /(\d+) (смен[а-яё]*) · [\d\s ]+ ч · норма месяца/.exec(t);
    ok("WORDS: график руководителя — «итог месяца: N смена/смены/смен» по числу", !!tot && tot[2] === word(Number(tot[1]), "смена", "смены", "смен"), tot ? tot[0] : t.slice(0, 200));
    ok("WORDS: «Часы за месяц» — то же число смен тем же словом", !!hint && !!tot && hint[1] === tot[1] && hint[2] === tot[2], hint ? hint[0] : "нет строки");
    ok("WORDS: график — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
}

// ═══ SOFT: фото без рывка ════════════════════════════════════════════════════════════════════════════
const toTeam = async (page) => { await page.locator("[data-chat-dock]").click(); await page.waitForTimeout(1200); await page.locator('[data-chat-item="team"]').first().click(); await page.waitForTimeout(400); };
if (want("SOFT")) {
  // ── лица: фото едет 900 мс, экран «Команда» уже открыт ──
  {
    const { ctx, page, errs } = await open({ who: "anna", flags: { __e2e_slow: "900,900,900" }, wait: 700 });
    await takeLog(page);
    await nav(page, "teamHub", 2600);
    const log = await takeLog(page);
    const ids = ["e-vera", "e-petr"];
    for (const id of ids) {
      const f = fadeOf(log, (r) => (id in r.faces ? r.faces[id] : undefined));
      ok("SOFT: лицо " + id + " приехало на открытый экран — проявилось, а не встало рывком (" + f.seq + ", " + f.ms + " мс)", f.soft && f.cls && !f.popped && f.end && f.end[0] === 1 && f.end[1] === 0 && f.ms !== null && f.ms > 250 && f.ms < 900, f);
    }
    const before = await page.evaluate(() => [...document.querySelectorAll("img[data-face]")].map((i) => ({ id: i.getAttribute("data-face"), letters: (i.parentElement.textContent || "").trim().slice(0, 3), cls: i.className })));
    ok("SOFT: под фото остались буквы, класса проявления на готовом фото нет", before.length >= 2 && before.every((x) => /^[А-ЯЁ]{1,2}$/.test(x.letters) && !/sa-photo-in/.test(x.cls)), before);
    ok("SOFT: за лицами сходили на сервер один раз", (await calls(page)).staff_photo === 1, await calls(page));
    // второй заход на экран: фото уже в памяти — стоит с первого кадра
    await nav(page, "roleSelect", 900); await takeLog(page);
    await nav(page, "teamHub", 1500);
    const again = await takeLog(page);
    for (const id of ids) {
      const f = fadeOf(again, (r) => (id in r.faces ? r.faces[id] : undefined));
      ok("SOFT: второй заход — лицо " + id + " стоит сразу, без проявления (" + f.seq + ")", f.seq === "1" && !f.cls && !f.soft, f);
    }
    // приложение закрыли и открыли: превью уже на телефоне — стоит сразу, на сервер не идём
    await relaunch(page, errs); await takeLog(page);
    await nav(page, "teamHub", 1500);
    const cold = await takeLog(page);
    for (const id of ids) {
      const f = fadeOf(cold, (r) => (id in r.faces ? r.faces[id] : undefined));
      ok("SOFT: после перезапуска — лицо " + id + " стоит сразу (" + f.seq + ")", f.seq === "1" && !f.cls, f);
    }
    ok("SOFT: после перезапуска за лицами на сервер не ходили", (await calls(page)).staff_photo === 0, await calls(page));
    await shot(page, "soft-team");
    ok("SOFT: лица — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
  // ── лица в рейтинге и на «Смене»: то же проявление у других видов кружка ──
  {
    const { ctx, page, errs } = await open({ who: "anna", flags: { __e2e_slow: "900,900,900" }, wait: 700 });
    await takeLog(page);
    await nav(page, "shift", 2600);
    const log = await takeLog(page);
    const f = fadeOf(log, (r) => ("u-maria" in r.faces ? r.faces["u-maria"] : undefined));
    ok("SOFT: «Смена» — лицо старшей проявилось (" + f.seq + ")", f.soft && f.cls && !f.popped && f.end && f.end[0] === 1, f);
    ok("SOFT: «Смена» — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
  // ── «меньше движения»: фото приезжает позже и встаёт без анимации ──
  {
    const { ctx, page, errs } = await open({ who: "anna", flags: { __e2e_slow: "900,900,900" }, wait: 700, reduce: true });
    await nav(page, "teamHub", 2600);
    const st = await page.evaluate(() => [...document.querySelectorAll("img[data-face]")].map((i) => ({ o: getComputedStyle(i).opacity, cls: i.className })));
    ok("SOFT: «меньше движения» — лица на месте, непрозрачные", st.length >= 2 && st.every((x) => x.o === "1" && !/sa-photo-in/.test(x.cls)), st);
    const anim = await page.evaluate(() => { const p = document.createElement("img"); p.className = "sa-photo-in"; document.body.appendChild(p); const a = getComputedStyle(p).animationName; p.remove(); return a; });
    ok("SOFT: «меньше движения» — у проявления анимации нет", anim === "none", anim);
    ok("SOFT: «меньше движения» — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
  // ── сервер без этапа 52: фото нет, в кружках буквы ──
  {
    const { ctx, page, errs } = await open({ who: "anna", demo: { __demo_no52: "1" }, wait: 700 });
    await nav(page, "teamHub", 1800);
    const st = await page.evaluate(() => ({ faces: document.querySelectorAll("img[data-face]").length, text: (document.body.innerText || "").replace(/\s+/g, " ") }));
    ok("SOFT: без этапа 52 — фото нет, экран как раньше (имена лидеров на месте)", st.faces === 0 && /Вера/.test(st.text) && /Пётр/.test(st.text), st.faces);
    ok("SOFT: без этапа 52 — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
  // ── фото «О нас» ──
  {
    const { ctx, page, errs } = await open({ who: "anna", flags: { __e2e_slow: "900,900,900" }, wait: 700 });
    await takeLog(page);
    await nav(page, "about", 2800);
    const log = await takeLog(page);
    const n = Math.max(0, ...log.map((r) => r.cn.length));
    ok("SOFT: «О нас» — фото на экране есть", n >= 1, n);
    const waited = log.some((r) => r.cn.length && r.cn.every((c) => c.wait === 1 && !c.img));
    ok("SOFT: «О нас» — пока фото едет, на его месте тихая подложка, слова «Фото…» нет", waited && !/Фото…/.test(await bodyText(page)));
    const f = fadeOf(log, (r) => (r.cn.length ? r.cn[0].img : undefined));
    ok("SOFT: «О нас» — фото проявилось (" + f.seq + ", " + f.ms + " мс)", f.soft && f.cls && !f.popped && f.end && f.end[0] === 1 && f.end[1] === 0, f);
    const after = await page.evaluate(() => [...document.querySelectorAll("[data-cn-photo]")].map((x) => ({ wait: x.querySelectorAll("[data-photo-wait]").length, img: !!x.querySelector("img"), w: Math.round(x.querySelector("img").getBoundingClientRect().width) })));
    ok("SOFT: «О нас» — подложка убрана, фото во всю рамку", after.length >= 1 && after.every((x) => x.wait === 0 && x.img && x.w > 100), after);
    await nav(page, "roleSelect", 900); await takeLog(page);
    await nav(page, "about", 1500);
    const again = await takeLog(page);
    const g = fadeOf(again, (r) => (r.cn.length ? r.cn[0].img : undefined));
    ok("SOFT: «О нас», второй заход — фото стоит сразу, подложки нет (" + g.seq + ")", g.seq === "1" && !g.cls && !again.some((r) => r.cn.some((c) => c.wait)), g);
    await shot(page, "soft-about");
    ok("SOFT: «О нас» — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
  // ── фото в чате: коллега прислала фото, Анна открывает чат на медленной сети ──
  {
    const { ctx, page, errs } = await open({ who: "anna", flags: { __e2e_slow: "900,900,900" }, wait: 700 });
    const sent = await page.evaluate(() => { const d = window.__demo, tok = "demo-u-maria";
      const f = d.srv.rpc("lesson_photo", { p_token: tok, p_lesson: "s0-1", p_full: true }), t = d.srv.rpc("lesson_photo", { p_token: tok, p_lesson: "s0-1", p_full: false });
      if (!f || !f.ok || !t || !t.ok) return { ok: false, why: "нет фото урока" };
      const chat = (d.srv.rpc("chat_list", { p_token: tok }).chats || []).find((c) => c.kind === "team");
      const r = d.srv.rpc("chat_photo_send", { p_token: tok, p_chat: chat.id, p_body: "", p_full: f.data, p_thumb: t.data, p_w: f.w, p_h: f.h }); d.save(); return { ok: !!(r && r.ok), id: r && r.msg && r.msg.photo && r.msg.photo.id }; });
    ok("SOFT: чат — коллега прислала фото", sent.ok, sent);
    await takeLog(page);
    await toTeam(page); await page.waitForTimeout(2600);
    const log = await takeLog(page);
    const has = log.some((r) => r.chat.length > 0);
    ok("SOFT: чат — сообщение с фото на экране", has);
    ok("SOFT: чат — пока фото едет, на его месте прежняя заглушка", log.some((r) => r.chat.length && r.chat[r.chat.length - 1].wait === 1 && !r.chat[r.chat.length - 1].img));
    const f = fadeOf(log, (r) => (r.chat.length ? r.chat[r.chat.length - 1].img : undefined));
    ok("SOFT: чат — фото проявилось (" + f.seq + ", " + f.ms + " мс)", f.soft && f.cls && !f.popped && f.end && f.end[0] === 1 && f.end[1] === 0, f);
    const box = await page.evaluate(() => { const p = [...document.querySelectorAll(".ch-ph[data-chat-photo]")].pop(); if (!p) return null; const i = p.querySelector("img"), a = p.getBoundingClientRect(), b = i.getBoundingClientRect();
      return { wait: p.querySelectorAll(".ch-ph-wait").length, same: Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1, w: Math.round(a.width), style: i.getAttribute("style"), cls: i.className }; });
    ok("SOFT: чат — фото стоит во всю рамку, ни стиля, ни класса на нём не осталось", box && box.wait === 0 && box.same && box.w > 100 && !box.style && !box.cls, box);
    await shot(page, "soft-chat");
    ok("SOFT: чат — без ошибок страницы", errs.length === 0, errs);
    await ctx.close();
  }
}

console.log("\nитого: ✓ " + pass + (fail ? ", ✗ " + fail : ""));
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
