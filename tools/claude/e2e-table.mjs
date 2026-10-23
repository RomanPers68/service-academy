// e2e: формат «у стола» в приложении (v27) — меню раздела, практика, проверка после урока,
// повтор ошибки, продолжение с места, классический вид, кнопка «Назад» Telegram.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5193, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-table";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SEASONAL_MODULES } = await import(SRC + "/data/modules-seasonal.js");
const ALL_SITS = SEASONAL_MODULES.flatMap(m => m.lessons).filter(l => l.type === "practice").flatMap(l => l.situations);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const prof = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
const uk = `_${prof.name}_${prof.surname}`;
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function open({ storage = {}, telegram = false, light = false, w = 390, h = 844 }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const fn = m[1];
      const mock = {
        whoami: { ok: true, employee: { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false } },
        my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: Object.keys(storage["sa_completed{uk}"] || {}), stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "none" },
      };
      if (mock[fn] !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[fn]) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    }
    return route.abort();
  });
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(prof), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_last_role: JSON.stringify("seasonal"), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  for (const [k, v] of Object.entries(storage)) seed[k.replace("{uk}", uk)] = typeof v === "string" ? v : JSON.stringify(v);
  await ctx.addInitScript(([seed, telegram]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (telegram) {
      const handlers = new Set();
      window.__bb = { visible: false, handlers, press() { [...handlers].forEach(h => h()); } };
      window.Telegram = { WebApp: { initData: "query_id=x", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
        BackButton: { show() { window.__bb.visible = true; }, hide() { window.__bb.visible = false; }, onClick(h) { handlers.add(h); }, offClick(h) { handlers.delete(h); } } } };
    }
  }, [seed, telegram]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

const text = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
async function toModule(page, title = "Психология первого дня") {
  await page.evaluate(() => window.__saNav("home")); await sleep(1500);
  // v28 (Доп. 307): трек — меню тем, листаются; тема выбирается номером в оглавлении
  await page.locator('.tbp-num[aria-label*="' + title + '"]').first().click({ timeout: 5000 });
  await sleep(900);
}
// какой вариант верный — по тексту ситуации на экране
async function correctText(page) {
  const info = await page.evaluate(() => {
    const t = (sel) => { const el = document.querySelector(".tb " + sel); return el ? el.innerText.trim() : ""; };
    return { scene: t(".tb-scene p"), claim: t(".tb-claim"), cloze: t(".tb-note.cloze p") };
  });
  let s = null;
  if (info.scene) s = ALL_SITS.find(x => x.scene && x.scene.trim() === info.scene);
  else if (info.claim) s = ALL_SITS.find(x => x.statement && info.claim.includes(x.statement.replace(/^«|»$/g, "").slice(0, 30)));
  else if (info.cloze) s = ALL_SITS.find(x => x.start && info.cloze.startsWith(x.start.trim().slice(0, 25)));
  if (!s) return null;
  const right = s.options[s.correct];
  if ((s.genre || s.type) === "truefalse") return /невер|❌/i.test(right) ? "Миф" : "Правда";
  return right;
}
async function pickOption(page, want, good = true) {
  const btns = page.locator(".tb .tb-actc, .tb .tb-reply, .tb .tb-chip2, .tb .tb-myth button");
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const t = (await btns.nth(i).innerText()).trim().replace(/\s+/g, " ");
    const hit = t.startsWith(want.replace(/\s+/g, " ").slice(0, 20)) || (want.length <= 6 && t.startsWith(want));
    if (good ? hit : !hit) { await btns.nth(i).click(); return t; }
  }
  return null;
}
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });

for (const theme of [{ light: false, w: 390, h: 844, tag: "dark-390" }, { light: true, w: 360, h: 780, tag: "light-360" }]) {
  const T = theme.tag;
  const QL = SEASONAL_MODULES[0].lessons.find(l => l.type === "quiz"), Q0 = QL.questions[0];
  const bank = [{ q: Q0.q, options: Q0.options, correct: Q0.correct, explanation: Q0.explanation || "", img: null, lessonTitle: QL.title, lessonId: QL.id, stage: 0, due: 0 }];
  const { ctx, page, errors } = await open({ ...theme, telegram: true, storage: { "sa_completed{uk}": { "s0-1": true }, "sa_mistakes{uk}": bank } });

  // ── 1. меню раздела
  await toModule(page);
  await shot(page, T + "-01-module");
  let t = await text(page);
  ok(T + ": меню раздела — название, «пройден», текущий шаг", /Психология первого дня/i.test(t) && /пройден/i.test(t) && /Дальше/i.test(t), t.slice(0, 120));
  ok(T + ": в меню видно время шагов и сколько осталось", /осталось ≈/i.test(t) && /мин/i.test(t));
  const ov = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(T + ": меню без горизонтальной прокрутки", !ov);

  // ── 2. урок: текущий шаг → последняя карточка → «Закрепить у стола»
  await page.locator(".tbm-cur:not(.tbp-side *)").first().click(); await sleep(1100);
  t = await text(page);
  ok(T + ": открылся урок «Как справляться со стрессом»", /Как справляться со стрессом/i.test(t));
  for (let i = 0; i < 12; i++) { const last = await page.locator("text=Закрепить у стола").count(); if (last) break; await page.locator("span", { hasText: /^›$/ }).last().click().catch(() => {}); await sleep(450); }
  await shot(page, T + "-02-lesson-end");
  ok(T + ": в конце урока «Закрепить у стола» и «Урок пройден ✓»", (await page.locator("text=Закрепить у стола").count()) > 0 && (await page.locator("text=Урок пройден ✓").count()) > 0);
  ok(T + ": кнопка обещает повтор (ошибка с подошедшим сроком)", /\+ повтор/i.test(await text(page)));
  await page.locator("[data-tb-check]").click(); await sleep(800);
  await shot(page, T + "-03-check-ask");
  t = await text(page);
  ok(T + ": проверка у стола — ситуация 1 из 2, лицо зала", /Ситуация 1 из 2/i.test(t) && (await page.locator(".tb .tb-mood").count()) === 1, t.slice(0, 100));
  // промах → реакция, записка, «Спасти ситуацию»
  let want = await correctText(page);
  ok(T + ": верный ответ ситуации найден в данных", !!want, String(want));
  const picked = await pickOption(page, want || "", false);
  await sleep(1500);
  await shot(page, T + "-04-check-miss");
  t = await text(page);
  const rescuable = /Спасти ситуацию/i.test(t);
  ok(T + ": промах — записка наставника «Не совсем» и «Лучше так»", /Не совсем/i.test(t) && /(Лучше так|Ответ)/i.test(t), (picked || "").slice(0, 40));
  if (rescuable) {
    await page.locator("text=Спасти ситуацию").click(); await sleep(500);
    await shot(page, T + "-05-check-second");
    ok(T + ": второй шанс — неверный вариант убран", /Второй шанс/i.test(await text(page)));
    await pickOption(page, want, true); await sleep(1500);
    await shot(page, T + "-06-check-saved");
    ok(T + ": спасено — записка «Спасено»", /Спасено/i.test(await text(page)));
  }
  await page.locator(".tb-foot .tb-main").click(); await sleep(700);
  ok(T + ": вторая ситуация", /Ситуация 2 из 2/i.test(await text(page)));
  want = await correctText(page);
  await pickOption(page, want || "", true); await sleep(1500);
  await shot(page, T + "-07-check-right");
  t = await text(page);
  ok(T + ": верно — записка наставника и реакция зала", /(Так и надо|Верно|В точку|Именно так|Как по стандарту)/i.test(t), t.slice(-160));
  await page.locator(".tb-foot .tb-main").click(); await sleep(700);
  t = await text(page);
  ok(T + ": напоследок — вопрос из «Работы над ошибками»", /Напоследок/i.test(t) && /Из «Работы над ошибками»/i.test(t), t.slice(0, 160));
  await shot(page, T + "-08-check-bank");
  await pickOption(page, Q0.options[Q0.correct], true); await sleep(1300);
  t = await text(page);
  ok(T + ": повтор верно — «Закреплено», следующий повтор через 1 день", /Закреплено/i.test(t) && /через 1 день/i.test(t));
  await page.locator(".tb-foot .tb-main").click(); await sleep(1600);
  await shot(page, T + "-09-check-receipt");
  t = await text(page);
  ok(T + ": чек «Урок пройден» с серией и повтором", /Урок пройден/i.test(t) && /Серия/i.test(t) && /Повтор ошибки/i.test(t), t.slice(0, 200));
  const st = await page.evaluate((uk) => ({ c: JSON.parse(localStorage.getItem("sa_completed" + uk) || "{}"), s: JSON.parse(localStorage.getItem("sa_streak" + uk) || "null"), m: JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]") }), uk);
  ok(T + ": урок отмечен пройденным", !!st.c["s0-2"], JSON.stringify(st.c));
  ok(T + ": свеча зажглась (серия ≥ 1 сегодня)", st.s && st.s.count >= 1);
  const bq = st.m.find(x => x.q === bank[0].q);
  ok(T + ": повтор сдвинул вопрос на следующий интервал", bq && bq.stage === 1 && bq.due > Date.now(), JSON.stringify(bq && { stage: bq.stage }));
  ok(T + ": промах у стола попал в «Работу над ошибками»", st.m.some(x => x.from === "practice"), String(st.m.length));
  const btn = await page.locator(".tb-foot .tb-main").innerText();
  ok(T + ": кнопка чека ведёт к следующему уроку", /Дальше: /i.test(btn), btn);
  await page.locator(".tb-foot .tb-main").click(); await sleep(1200);
  t = await text(page);
  ok(T + ": «Дальше» открыл следующий урок «Анатомия смены»", /Анатомия смены/i.test(t) && (await page.locator(".tb").count()) === 0, t.slice(0, 80));

  // ── 3. место в уроке: ушёл с 3-й карточки — вернулся туда же
  await page.locator("span", { hasText: /^›$/ }).last().click(); await sleep(400);
  await page.locator("span", { hasText: /^›$/ }).last().click(); await sleep(400);
  await page.evaluate(() => window.__bb.press()); await sleep(1000);
  await page.locator(".tbm-node:not(.tbp-side *)", { hasText: "Анатомия смены" }).first().click(); await sleep(1000);
  t = await text(page);
  await shot(page, T + "-10-lesson-resume");
  ok(T + ": урок открылся с того же места", /Продолжаем с того же места: карточка 3/i.test(t), t.slice(0, 160));
  await page.locator("text=С начала").click(); await sleep(500);
  ok(T + ": «С начала» вернул на первую карточку", !/Продолжаем с того же места/i.test(await text(page)));
  await page.evaluate(() => window.__bb.press()); await sleep(1000);

  // ── 4. практика «у стола»
  await page.locator(".tbm-node:not(.tbp-side *)", { hasText: "Практика: первый день" }).first().click(); await sleep(1300);
  await shot(page, T + "-11-practice-ask");
  t = await text(page);
  ok(T + ": практика открылась у стола — тарелки, ситуация 1", (await page.locator(".tb .tb-plates").count()) === 1 && /Ситуация 1 из/i.test(t), t.slice(0, 100));
  want = await correctText(page);
  await pickOption(page, want || "", false); await sleep(600);
  await shot(page, T + "-12-practice-miss");
  t = await text(page);
  ok(T + ": промах — разбитая тарелка и записка", (await page.locator(".tb .tb-plate.broken").count()) === 1 && /Не совсем|Время вышло/i.test(t));
  await page.locator(".tb-foot .tb-main").click(); await sleep(500);
  want = await correctText(page);
  await pickOption(page, want || "", true); await sleep(600);
  await shot(page, T + "-13-practice-right");
  ok(T + ": верно — «+10 очков»", /\+10 очков/i.test(await text(page)));
  // уходим посреди раунда → шторка «Выйти?» (кнопка «Назад» Telegram) → выходим
  await page.evaluate(() => window.__bb.press()); await sleep(500);
  await shot(page, T + "-14-practice-exit-sheet");
  ok(T + ": «Назад» посреди раунда спрашивает «Выйти из практики?»", /Выйти из практики\?/i.test(await text(page)));
  await page.evaluate(() => window.__bb.press()); await sleep(400);
  ok(T + ": повторное «Назад» закрывает шторку (остаёмся)", !/Выйти из практики\?/i.test(await text(page)) && (await page.locator(".tb").count()) === 1);
  await page.locator(".tb-x").click(); await sleep(300);
  await page.locator(".tb-sheet .tb-ghost").click(); await sleep(900);
  ok(T + ": вышли в меню раздела", (await page.locator(".tbm-menu:not(.tbp-side *)").count()) === 1);
  await page.locator(".tbm-node:not(.tbp-side *)", { hasText: "Практика: первый день" }).first().click(); await sleep(1300);
  t = await text(page);
  ok(T + ": практика продолжилась с той же ситуации (2 из 8 — ответ уже дан)", /Ситуация 2 из/i.test(t) && /\+10 очков/i.test(t), t.slice(0, 120));
  // классический вид и обратно
  await page.locator("[aria-label='Классический вид практики']").click(); await sleep(600);
  await shot(page, T + "-15-practice-classic");
  // v75: сердечки — значками (svg) вместо ❤️
  ok(T + ": классический вид — прежний экран практики (сердечки, очки)", (await page.locator(".tb").count()) === 0 && (await page.locator("[data-practice-lives] svg").count()) === 3);
  await page.locator("[aria-label='Вид «у стола»']").click(); await sleep(600);
  ok(T + ": обратно «у стола»", (await page.locator(".tb").count()) === 1);
  // доигрываем раунд верными ответами
  for (let i = 0; i < 12; i++) {
    const done = /Практика пройдена|Раунд окончен/i.test(await text(page));
    if (done) break;
    const main = page.locator(".tb-foot .tb-main");
    if (await main.count()) { await main.click(); await sleep(450); continue; }
    want = await correctText(page);
    const r = await pickOption(page, want || "", true);
    if (!r) { const any = page.locator(".tb .tb-actc, .tb .tb-chip2, .tb .tb-myth button"); if (await any.count()) await any.first().click(); }
    await sleep(500);
  }
  await sleep(1200);
  await shot(page, T + "-16-practice-receipt");
  t = await text(page);
  ok(T + ": итог раунда — чек, звёзды, разбор", /Практика пройдена/i.test(t) && /Разбор раунда/i.test(t) && /ОЧКИ/i.test(t), t.slice(0, 160));
  await page.locator(".tb-foot .tb-main").click(); await sleep(1300);
  const stars = await page.evaluate(() => localStorage.getItem("sa_practice_stars"));
  ok(T + ": «Продолжить» сохранил звёзды практики и вернул в раздел", /s0-p/i.test(stars || "") && (await page.locator(".tbm-menu:not(.tbp-side *)").count()) === 1, String(stars).slice(0, 80));
  await shot(page, T + "-17-module-after");
  const resume = await page.evaluate((uk) => localStorage.getItem("sa_practice_resume" + uk), uk);
  ok(T + ": законченный раунд не «продолжается»", resume === null, String(resume).slice(0, 60));
  ok(T + ": ошибок страницы нет", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

console.log(results.join("\n"));
console.log("\nИтого: " + results.filter(r => r.startsWith("✓")).length + " ✓, " + results.filter(r => r.startsWith("✗")).length + " ✗");
await browser.close(); server.close();
