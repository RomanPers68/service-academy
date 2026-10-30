// e2e-integration.mjs — свои уроки редактора и остальное приложение (правка 163)
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", PORT = 5232;
const { HINTS, HINTS_VERSION } = await import("/home/claude/work/service-academy/data/hints.js");
const server = http.createServer((q, r) => { const p = decodeURIComponent(q.url.split("?")[0]); let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  r.writeHead(200, { "Content-Type": { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" }[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const results = []; const check = (n, c, x = "") => results.push(`${c ? "✓" : "✗"} ${n}${x ? " — " + x : ""}`);
const LESSONS = [
  { id: 11, role: "seasonal", module: "Субординация", title: "Кто кому подчиняется", content: "Старший смены отвечает за зал, пока менеджера нет.", sort: 1,
    questions: [{ q: "Кто главный в смене без менеджера?", options: ["Старший смены", "Повар"], correct: 0, explanation: "Старший отвечает за зал" },
      { kind: "review", guest: "Пара на годовщине", table: "стол 7", text: "Нас встретили как родных: сразу объяснили, кто решит вопрос, и через минуту всё было улажено." }] },
  { id: 12, role: "seasonal", module: "Субординация", title: "Если менеджера нет", content: "Решения при гостях принимает старший смены.", sort: 2, questions: [] },
  { id: 31, role: "bar", module: "Наши коктейли", title: "Фирменный сауэр", content: "Сначала сухой шейк, потом со льдом.", sort: 1, questions: [
    { kind: "build", title: "Фирменный сауэр", glass: "coupe", tint: "#E8B04A", win: "Да", lose: "Нет", steps: [
      { label: "Бокал", q: "С чего начинаешь?", cost: "", options: [{ t: "Купе", ok: true, fb: "" }, { t: "Пинта", fb: "" }] } ] } ] },
  { id: 13, role: "seasonal", module: "Сложные гости", title: "Гость требует менеджера", content: "Зови старшего смены — решение за ним.", sort: 1, questions: [
    { kind: "dialogue", tip: "Решает старший смены", guest: { name: "Ольга", avatar: "👩", context: "Недовольна и требует менеджера", mood: 2 }, steps: [
      { type: "guest", text: "Позовите менеджера!" },
      { type: "choice", prompt: "Что ответишь?", options: [{ text: "Сейчас позову старшего смены", correct: true, feedback: "Верно", moodDelta: 1 }, { text: "Менеджера нет", correct: false, feedback: "Холодно", moodDelta: -1 }] } ] } ] } ];
const rpcLog = []; let offlineCms = false;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route("**/*", async (route) => {
  const req = route.request(), u = req.url();
  if (u.startsWith(`http://localhost:${PORT}`) && !u.includes("/api/")) return route.continue();
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  const m = u.match(/\/rpc\/([a-z_0-9]+)/); const fn = m && m[1];
  if (fn === "whoami") return route.abort();   // как офлайн: приложение держит профиль из памяти
  if (fn) { rpcLog.push({ fn, body: JSON.parse(req.postData() || "{}") }); }
  if (fn === "cms_list_lessons") return offlineCms ? route.abort() : json(LESSONS);
  if (fn) return json({ ok: true });
  return route.abort();
});
const seed = { sa_session_token: "p", sa_profile: JSON.stringify({ id: "u", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter" }),
  sa_a11y: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify("seasonal"),
  "sa_mistakes_Анна_Смирнова": JSON.stringify([
    { q: "Вопрос из удалённого урока?", options: ["a", "b"], correct: 0, lessonTitle: "Тест: Удалённый раздел", stage: 0, due: 1 },
    { q: "Кто главный в смене без менеджера?", options: ["Старший смены", "Повар"], correct: 0, lessonTitle: "Тест: Субординация", stage: 0, due: 1 }]) };
for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
await ctx.addInitScript((s) => { if (localStorage.getItem("__s")) return; localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); localStorage.setItem("__s", "1"); }, seed);
const page = await ctx.newPage(); const errors = [];
page.on("pageerror", e => errors.push("сбой: " + e.message));
const text = () => page.evaluate(() => document.body.innerText);
const nav = async (to) => { await page.evaluate((t) => window.__saNav && window.__saNav(t), to); await page.waitForTimeout(1300); };
// v28 (Доп. 307): трек — меню тем, листаются; свой раздел — номер «✦» в оглавлении
const openSub = async () => { await page.evaluate(() => { const b = document.querySelector('.tbp-num[aria-label*="Субординация"]'); if (b) b.click(); }); await page.waitForTimeout(1300); };
const clickText = (re) => page.evaluate((src) => { const r = new RegExp(src); const el = [...document.querySelectorAll("button,div,span")].filter(x => x.offsetParent !== null && r.test((x.innerText || "").trim())).pop(); if (el) { (el.closest("button") || el).click(); return true; } return false; }, re.source);
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(3500);
const bankNow = await page.evaluate(() => JSON.parse(localStorage.getItem("sa_mistakes_Анна_Смирнова") || "[]").map(m => m.q));
check("удаление: ошибка из удалённого урока ушла из банка, живая осталась", !bankNow.includes("Вопрос из удалённого урока?") && bankNow.includes("Кто главный в смене без менеджера?"), JSON.stringify(bankNow));
await nav("home"); await page.waitForTimeout(1500);
check("главный: свой раздел — в оглавлении трека", (await page.locator('.tbp-num[aria-label*="Субординация"]').count()) === 1);
await openSub();
let t = await text();
check("главный: у своего раздела — своё меню в треке", /Субординация/.test(t) && /Раздел вашего ресторана/.test(t));
// карточка текущего шага в меню своего раздела: «шаг 1 из 3»
const curCard = await page.evaluate(() => (document.querySelector(".tbp-cur .tbm-cur") || {}).innerText || "");
check("свой раздел: следующий шаг — внутри раздела", /1 из \d/.test(curCard) && /Кто кому подчиняется/.test(curCard), curCard.replace(/\s+/g, " ").slice(0, 90));
// свой тест: ошибка → аналитика и «Работа над ошибками»
await clickText(/^Тест: Субординация$/); await page.waitForTimeout(1500);
for (let i = 0; i < 10; i++) {
  const st = await page.evaluate(() => { const vis = [...document.querySelectorAll("button,div")].filter(b => b.offsetParent !== null && !b.disabled);
    const next = vis.filter(b => b.tagName === "BUTTON").find(b => /^(Дальше|Далее|Продолжить|Результат|Готово|Завершить|Показать итог|Понятно|Попробовать снова)/.test((b.innerText || "").trim()));
    if (next) { next.click(); return "дальше:" + next.innerText.trim().slice(0, 18); }
    const opt = vis.filter(b => (b.innerText || "").trim() === "Повар").pop(); if (opt && !window.__a1) { window.__a1 = 1; opt.click(); return "ответ"; }
    return "ждать"; });
  await page.waitForTimeout(500);
  if (st === "ждать") break;
}
await page.waitForTimeout(600);
const logged = rpcLog.filter(x => x.fn === "log_quiz_answer");
check("свой тест: ответ записан для аналитики под номером теста", logged.some(x => x.body.p_lesson === "cms-q-11"), JSON.stringify(logged.map(x => x.body.p_lesson)));
const bank = await page.evaluate(() => { const k = Object.keys(localStorage).find(k => /mistake/i.test(k) && localStorage.getItem(k).includes("Кто главный")); return k ? localStorage.getItem(k).slice(0, 400) : ""; });
check("свой тест: ошибка — в «Работе над ошибками»", /Кто главный в смене без менеджера/.test(bank), bank.slice(0, 120));
// пересдача верно → результат в рейтинг
await page.evaluate(() => { window.__a1 = 0; });
await nav("home");
await openSub();
await page.waitForTimeout(1200); await clickText(/^Тест: Субординация$/); await page.waitForTimeout(1500);
for (let i = 0; i < 10; i++) {
  const st = await page.evaluate(() => { const vis = [...document.querySelectorAll("button,div")].filter(b => b.offsetParent !== null && !b.disabled);
    const opt = vis.filter(b => (b.innerText || "").trim() === "Старший смены").pop(); if (opt && !window.__a2) { window.__a2 = 1; opt.click(); return "ответ"; }
    const next = vis.filter(b => b.tagName === "BUTTON").find(b => /^(Дальше|Далее|Продолжить|Результат|Готово|Завершить|Показать итог|Понятно)/.test((b.innerText || "").trim()));
    if (next) { next.click(); return "дальше"; } return "ждать"; });
  await page.waitForTimeout(500);
  if (rpcLog.some(x => x.fn === "save_score")) break;
}
const sc = rpcLog.filter(x => x.fn === "save_score").map(x => x.body);
check("свой тест: результат ушёл в рейтинг (save_score) под номером теста", sc.some(x => x.p_quiz_id === "cms-q-11"), JSON.stringify(sc).slice(0, 160));
// поиск
await nav("search");
await page.evaluate(() => { const i = document.querySelector("input"); if (i) { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; s.call(i, "подчиняется"); i.dispatchEvent(new Event("input", { bubbles: true })); } });
await page.waitForTimeout(900); t = await text();
check("поиск: находит свой урок", /Кто кому подчиняется/.test(t), t.slice(0, 160).replace(/\s+/g, " "));
// «Дальше» после урока своего раздела — следующий урок этого раздела (правка 164)
await nav("home");
await openSub();
await page.waitForTimeout(1200); await clickText(/^Кто кому подчиняется$/); await page.waitForTimeout(1500);
await clickText(/^Урок пройден/); await page.waitForTimeout(1500); t = await text();
check("после урока своего раздела «Дальше» — следующий урок этого же раздела", /Если менеджера нет/.test(t) && !/Первый день: нормально/.test(t), (t.match(/[^\n]*(Если менеджера нет|Первый день)[^\n]*/) || [""])[0].slice(0, 100));
await clickText(/Если менеджера нет/); await page.waitForTimeout(1500); t = await text();
check("подсказка «позади N непройденных» не зовёт в штатную программу", !/ПОЗАДИ \d+ НЕПРОЙДЕНН/.test(t) || !/Первый день: нормально/.test(t));
check("тап по «Дальше» открывает именно его", /Решения при гостях принимает старший смены/.test(t), t.slice(0, 120).replace(/\s+/g, " "));
await clickText(/^Урок пройден/); await page.waitForTimeout(1200);
await nav("home");
await openSub();
await page.waitForTimeout(1300); t = await text();
check("книга: раздел пройден — в модуле баннер новой страницы", /страниц/i.test(t) && /книг/i.test(t), (t.match(/[^\n]*страниц[^\n]*/i) || [""])[0].slice(0, 90));
await clickText(/^ЧИТАТЬ/i);
await page.waitForTimeout(1600); t = await text();
await page.screenshot({ path: "/home/claude/preview/shots/book-custom.png" });
check("книга: открывается страница своего раздела с отзывом гостя", /Нас встретили как родных/.test(t) && /Пара на годовщине/.test(t), t.slice(0, 160).replace(/\s+/g, " "));
// «Задания дня»: у главы справочника — её настоящий курс (правка 169)
await nav("daily"); await page.waitForTimeout(900); t = await text();
const ref = t.match(/СПРАВОЧНИК · (?:ГЛАВА|ФОТО-ТЕСТ)\s*\n([^\n]+)\n\s*Курс: ([^\n]+)/);
check("задания дня: курс главы — настоящий, а не всегда «Сервировка»", !!ref, ref ? ref[1] + " → " + ref[2] : (t.match(/[^\n]*Курс:[^\n]*/) || ["нет строки курса"])[0]);
if (ref) { globalThis.__refPair = [ref[1].trim(), ref[2].trim()]; }
// «Учусь»: процент трека считает свой раздел (правка 165)
await nav("roleSelect");
await clickText(/^Официант$/); await page.waitForTimeout(700); t = await text();
const pm = t.match(/Новичок\s*\n?\s*Сезонный сотрудник\s*\n?\s*(\d+)%/);
check("«Учусь»: у «Новичка» процент учитывает пройденный свой урок", pm && +pm[1] > 0, pm ? pm[0].replace(/\s+/g, " ") : t.slice(t.indexOf("Новичок"), t.indexOf("Новичок") + 60).replace(/\s+/g, " "));
// книга отзывов
// счёт книги на «Учусь»: 1 страница из 38 (37 штатных + свой раздел)
await nav("roleSelect"); t = await text();
// всего страниц — по всем трекам (вся программа подгружена); открыта ровно одна — своя
check("книга: счёт на «Учусь» — одна открытая страница, своя", /Книга отзывов\s*\n?\s*1\/\d+/.test(t), (t.match(/Книга отзывов[^\n]*\n?[^\n]*/) || [""])[0].replace(/\s+/g, " "));
// «Мой прогресс» (правка 167)
await nav("stats"); t = await text();
const pr = t.replace(/\s+/g, " ");
check("«Мой прогресс»: роль считает свои уроки, свой тест — в последних", /Новичок \d+% \d+ из \d+ · 1 тест пройдено/.test(pr) && /Тест: Субординация 100%/.test(pr), (pr.match(/Новичок \d+%[^·]*·[^·]*/) || [""])[0]);
// «Гость недели» может выпасть своим диалогом (правка 168). Неделя с 7 октября 2026 —
// как раз такая: выбор на неделе постоянный, поэтому её можно подставить.
await ctx.addInitScript(() => { const R = Date; const fixed = new R("2026-10-07T12:00:00").getTime();
  class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } }
  window.Date = D; });
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(2500);
await nav("weeklyGuest"); await page.waitForTimeout(1500); t = await text();
check("гость недели: выпал свой диалог — гость и его реплика", /Ольга/.test(t) && /Позовите менеджера!/.test(t), t.slice(0, 140).replace(/\s+/g, " "));
await page.evaluate(() => { window.__answered = {}; });
for (let i = 0; i < 22; i++) {
  const st = await page.evaluate(() => {
    const vis = [...document.querySelectorAll("button,div,span")].filter(b => b.offsetParent !== null && !b.disabled);
    const next = vis.filter(b => b.tagName === "BUTTON").find(b => /^(Закрыть|Дальше|Далее|Продолжить|Готово|Завершить)/.test((b.innerText || "").trim()));
    if (next) { next.click(); return "дальше"; }
    window.__answered = window.__answered || {};
    const opt = vis.filter(b => /^Сейчас позову старшего смены$/.test((b.innerText || "").trim()) && !window.__answered["a"]).pop();
    if (opt) { window.__answered["a"] = 1; opt.click(); return "ответ"; }
    return "ждать";
  });
  await page.waitForTimeout(st === "ждать" ? 900 : 600);   // после ответа гость «думает» — просто ждём
  const done = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("sa_completed_Анна_Смирнова") || "{}")).some(k => k.startsWith("weekly_")));
  if (done) break;
}
const wk = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("sa_completed_Анна_Смирнова") || "{}")).filter(k => k.startsWith("weekly_")));
check("гость недели: свой диалог доведён до конца — испытание недели засчитано", wk.includes("weekly_2026-w41"), JSON.stringify(wk));
// без сети свои разделы — из копии на телефоне (правка 167)
offlineCms = true;
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(2500);
await nav("home"); await openSub(); t = await text();
check("без сети: свой раздел на месте — из копии на телефоне", /Субординация/.test(t) && /Раздел вашего ресторана/.test(t));
// книга: вкладка «Сборка» видит свою сборку бара (правка 173)
await nav("guestbook"); await page.waitForTimeout(600);
await page.evaluate(() => { const b = [...document.querySelectorAll("button,div,span")].filter(x => x.offsetParent !== null && /^Сборка$/.test((x.innerText || "").trim())).pop(); if (b) (b.closest("button") || b).click(); });
await page.waitForTimeout(900); t = await text();
check("книга: во вкладке «Сборка» есть своя сборка бара", /Фирменный сауэр/.test(t), t.slice(0, 130).replace(/\s+/g, " "));
// карта обучения считает свои уроки так же, как «Мой прогресс»
await nav("stats"); await page.waitForTimeout(800);
const statsTxt = (await text()).replace(/\s+/g, " ");
const statTotal = (statsTxt.match(/Новичок[^·]*?(\d+) из (\d+)/) || [])[2];
await nav("trainingCard"); await page.waitForTimeout(1200); t = await text();
const cardTxt = t.replace(/\s+/g, " ");
const cardTotal = (cardTxt.match(/Новичок[^·]*?(\d+)\s*(?:из|\/)\s*(\d+)/) || [])[2];
check("карта обучения считает столько же шагов, сколько «Мой прогресс»", !!statTotal && statTotal === cardTotal, `прогресс ${statTotal} · карта ${cardTotal}`);
check("ошибок страницы нет", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(results.join("\n"));
await browser.close(); server.close();
