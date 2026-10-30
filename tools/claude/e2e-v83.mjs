// e2e v83 (Доп. 396): случаи из нашего зала.
// Разделы:
//   TELL    — сотрудник: пункт в «Смене» → «Рассказать случай» (короткий — подсказка; что сделал, итог, без имени) →
//             case_submit; «Мои случаи»: «Ждёт разбора», удалить свой (двумя нажатиями);
//   REVIEW  — руководитель: в «Смене» число «ждут разбора»; разбор — сцена из рассказа, неверный вариант из «что сделал»,
//             «как было у нас»; без верного не публикуется; публикация → case_review (ситуация, верный первым);
//             «Не для тренировки» с ответом автору; разобранные;
//   PLAY    — сотрудник: «3 новых случая», экран снимает «новое»; «Разобрать новые» — «стол» в режиме cases: сначала
//             несыгранные, после ответа разбор, «как было у нас» и кто рассказал; итог, сыгранные запомнены, ошибка —
//             в «Работе над ошибками» под темой «Случаи из нашего зала»;
//   BRIEF   — брифинг смены (v82): блок «Случай из зала» из свежего опубликованного, ответ в показе по кнопке, в тексте
//             для Telegram — без ответа;
//   LINK    — ?go=cases из сообщения бота открывает экран случаев;
//   MISSING — нет этапа 33: пункта в «Смене» нет; экран (если открыть) честно говорит об этом;
//   PREFS   — «Напоминания в Telegram»: строка «Случаи из зала», переключатель → notify_set cases;
//   NARROW  — 320 px: экран и разбор без прокрутки вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v83.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5283, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v83";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));

const R0 = "Два моря, Океан";
const LEAD = { id: "u-lead", name: "Мария", surname: "Ким", restaurant: R0, position: "senior", is_admin: false };
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const NOW = new Date("2026-10-23T02:20:00Z");   // 23.10, 14:20 по Камчатке
const SIT = (scene, right, wrong, why, real) => ({ scene, question: "Как поступить?", options: [right, ...wrong], correct: 0, why, real, show_author: true });
const TEAM = [
  { id: 31, at: "2026-10-22T09:00:00Z", author: "Илья Бармен", sit: SIT("Гость за баром просит коктейль не из карты, а нужного сиропа нет.", "Предложить похожий коктейль из карты и рассказать, чем он близок", ["Сказать, что такого нет", "Сделать без сиропа и не предупредить"], "Гость пришёл за вкусом, а не за названием: похожий вкус из карты закрывает просьбу.", "Предложили «Апероль шприц» вместо «Хьюго», гость заказал второй.") },
  { id: 32, at: "2026-10-21T09:00:00Z", author: null, sit: SIT("Гость за шестым столом просит пересадить: дует из окна, свободных столов нет.", "Извиниться, предложить плед и первый освободившийся стол", ["Сказать, что мест нет", "Позвать менеджера и уйти"], "Гостю важно, что о нём позаботились сейчас и не забыли потом.", "") },
  { id: 33, at: "2026-10-20T09:00:00Z", author: "Анна Смирнова", sit: SIT("Гость просит счёт, а десерт ещё не принесли.", "Уточнить, ждать ли десерт, и принести счёт вместе с ним", ["Принести счёт без десерта", "Снять десерт молча"], "Гость мог забыть о десерте: вопрос бережёт и время, и чек.", "Гость попросил десерт с собой.") },
];
const INBOX = [
  { id: 41, author: "Анна Смирнова", author_id: "u-staff", anon: false, at: "2026-10-23T01:10:00Z", status: "new", outcome: "bad", note: "",
    story: "Гость за шестым столом попросил пересадить: дует из окна, а свободных столов у окна не было.", did: "Сказала, что мест нет, и ушла." },
  { id: 42, author: "Илья Бармен", author_id: "u-ilya", anon: true, at: "2026-10-23T00:40:00Z", status: "new", outcome: "saved", note: "",
    story: "Гость попросил коктейль без алкоголя, а в карте таких нет. Сделал безалкогольную версию мохито.", did: "Сделал безалкогольный мохито." },
];
const ABORT = Symbol("abort");
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function open({ who = STAFF, rpcs = () => undefined, calls = [], telegram = false, light = false, w = 393, h = 852, path = "/", seedExtra = {} } = {}) {
  const UK = ukOf(who);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      calls.push({ fn: m[1], body, t: Date.now() });
      const own = rpcs(m[1], body);
      if (own === ABORT) return route.abort();
      if (own !== undefined) return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own) });
      const mock = { whoami: { ok: true, employee: who }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] }, schedule_load: { ok: false, error: "auth" }, menu_get: [],
        qday_inbox: { ok: true, items: [] }, brief_today: { ok: true, brief: null } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }) };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  Object.assign(seed, seedExtra);
  await ctx.addInitScript(([seed, telegram]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (telegram) {
      window.Telegram = { WebApp: { initData: "query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
        openTelegramLink() {}, requestWriteAccess(cb) { setTimeout(() => cb && cb(true), 30); },
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
        BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} } } };
    }
  }, [seed, telegram]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + path, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors, calls, UK };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const toShift = async (page) => { await page.evaluate(() => window.__saNav("shift")); await sleep(1400); };
const item = (page) => page.locator('.sa-card[aria-label="Случаи из нашего зала"]');
// сервер случаев в памяти: case_list (full / counts), case_submit, case_review
function caseServer({ lead = false, team = [], inbox = [], mine = [], done = [] } = {}) {
  const S = { team: [...team], inbox: [...inbox], mine: [...mine], done: [...done], seq: 100, submits: [], reviews: [] };
  S.rpc = (fn, body) => {
    if (fn === "case_list") {
      if (body.p_mode === "counts") {
        const since = body.p_since ? Date.parse(body.p_since) : 0;
        return { ok: true, lead, team: S.team.length, fresh: S.team.filter((x) => x.author !== "Анна Смирнова" && Date.parse(x.at) > since).length,
          inbox: lead ? S.inbox.length : 0, mine_new: 0, top: S.team[0] || null };
      }
      return { ok: true, lead, team: S.team, mine: S.mine, ...(lead ? { inbox: S.inbox, done: S.done } : {}) };
    }
    if (fn === "case_submit") {
      S.submits.push(body);
      const x = { id: ++S.seq, story: body.p_story, did: body.p_did, outcome: body.p_outcome, anon: body.p_anon, status: "new", note: "", at: NOW.toISOString() };
      S.mine.unshift(x);
      return { ok: true, id: x.id, sent: 2 };
    }
    if (fn === "case_review") {
      S.reviews.push(body);
      const all = [...S.inbox, ...S.done, ...S.mine];
      const x = all.find((y) => y.id === body.p_id);
      if (!x) return { ok: false, error: "not_found" };
      if (body.p_action === "delete") { for (const k of ["inbox", "done", "mine"]) S[k] = S[k].filter((y) => y.id !== x.id); return { ok: true, status: "deleted" }; }
      const st = body.p_action === "publish" ? "published" : "declined";
      S.inbox = S.inbox.filter((y) => y.id !== x.id);
      const upd = { ...x, status: st, note: body.p_note || "", sit: body.p_sit || x.sit, reviewed_at: NOW.toISOString() };
      S.done = [upd, ...S.done.filter((y) => y.id !== x.id)];
      if (st === "published") S.team = [{ id: x.id, at: NOW.toISOString(), author: upd.sit && upd.sit.show_author && !x.anon ? x.author : null, sit: upd.sit }, ...S.team.filter((y) => y.id !== x.id)];
      return { ok: true, status: st };
    }
    return undefined;
  };
  return S;
}

if (want("TELL")) {
  for (const light of [false, true]) {
    const tag = "TELL" + (light ? " светлая" : "");
    const S = caseServer({});
    const o = await open({ who: STAFF, light, rpcs: S.rpc });
    await sleep(1200); await toShift(o.page);
    const it = await txt(item(o.page));
    ok(tag + ": в «Смене» → «Потренироваться» пункт «Случаи из нашего зала»", /Случаи из нашего зала Расскажи свой, команда потренируется/.test(it), it);
    await item(o.page).first().click(); await sleep(1800);
    const train = await txt(o.page.locator("[data-case-train]"));
    ok(tag + ": случаев пока нет — так и сказано, кнопки тренировки нет", /Пока ни одного\. Расскажи случай со смены/.test(train) && !(await o.page.locator("[data-case-play]").count()), train);
    await o.page.locator("[data-case-tell-open]").click(); await sleep(300);
    await o.page.locator('[data-case-field="story"]').fill("Гость ругался"); await o.page.locator("[data-case-send]").click(); await sleep(300);
    ok(tag + ": коротко — подсказка, на сервер не уходит", /Расскажи чуть подробнее/.test(await txt(o.page.locator('[data-case-tell] [role="alert"]'))) && !S.submits.length);
    await o.page.locator('[data-case-field="story"]').fill("  Гость за шестым столом попросил пересадить:   дует из окна, а свободных столов нет.  ");
    await o.page.locator('[data-case-field="did"]').fill("Сказала, что мест нет, и ушла.");
    await o.page.locator('[data-case-outcome="bad"]').click();
    await o.page.locator('[data-case-toggle="anon"]').click();
    await shot(o.page, "tell-form" + (light ? "-light" : ""));
    await o.page.locator("[data-case-send]").click(); await sleep(900);
    const sb = S.submits[0] || {};
    ok(tag + ": case_submit — рассказ, что сделала, итог «ушёл недовольным», без имени", sb.p_token === "tok-preview" && sb.p_story === "Гость за шестым столом попросил пересадить:   дует из окна, а свободных столов нет." && sb.p_did === "Сказала, что мест нет, и ушла." && sb.p_outcome === "bad" && sb.p_anon === true, JSON.stringify(sb));
    ok(tag + ": «Отправлено. Руководитель разберёт случай…»", /Отправлено\. Руководитель разберёт случай, и команда потренируется на нём\./.test(await txt(o.page.locator('[role="status"]'))));
    const mine = o.page.locator("[data-case-mine]");
    ok(tag + ": «Мои случаи» — «Ждёт разбора» и удалить", (await mine.count()) === 1 && (await mine.getAttribute("data-status")) === "new" && /Ждёт разбора · 23 октября/.test(await txt(mine)), await txt(mine));
    await shot(o.page, "tell-mine" + (light ? "-light" : ""));
    const del = o.page.locator("[data-case-mine-delete]");
    await del.click(); await sleep(200);
    ok(tag + ": удалить — сначала переспрашивает", /Удалить\? Ещё раз/.test(await txt(del)) && !S.reviews.length);
    await del.click(); await sleep(800);
    ok(tag + ": второе нажатие — case_review delete, случай пропал", S.reviews.length === 1 && S.reviews[0].p_action === "delete" && !(await o.page.locator("[data-case-mine]").count()), JSON.stringify(S.reviews));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("REVIEW")) {
  for (const light of [false, true]) {
    const tag = "REVIEW" + (light ? " светлая" : "");
    const S = caseServer({ lead: true, inbox: INBOX, team: [] });
    const o = await open({ who: LEAD, light, rpcs: S.rpc });
    await sleep(1200); await toShift(o.page);
    const it = await txt(item(o.page));
    ok(tag + ": у руководителя в пункте — «2 ждут разбора» и число", /Случаи из нашего зала 2 ждут разбора 2/.test(it), it);
    await item(o.page).first().click(); await sleep(1800);
    ok(tag + ": «Ждут разбора · 2»: автор, «без имени для команды», итог", (await o.page.locator("[data-case-inbox]").count()) === 2
      && /Илья Бармен \(без имени для команды\) · 23 октября · обошлось/.test(await txt(o.page.locator('[data-case-inbox="42"]'))), await txt(o.page.locator('[data-case-inbox="42"]')));
    await shot(o.page, "review-inbox" + (light ? "-light" : ""));
    await o.page.locator('[data-case-inbox="41"]').click(); await sleep(600);
    const val = (n) => o.page.locator(`[data-case-field="${n}"]`).inputValue();
    ok(tag + ": черновик: сцена — рассказ, вопрос «Как поступить?», неверный — что сделала (итог плохой), «как было у нас»",
      (await val("scene")) === INBOX[0].story && (await val("question")) === "Как поступить?" && (await val("right")) === "" && (await val("wrong0")) === INBOX[0].did
      && (await val("real")) === "Что сделали: Сказала, что мест нет, и ушла. Итог: гость ушёл недовольным.", await val("real"));
    await o.page.locator("[data-case-publish]").click(); await sleep(300);
    ok(tag + ": без верного варианта — «Напиши, как правильно», на сервер не уходит", /Напиши, как правильно/.test(await txt(o.page.locator('[data-case-review] [role="alert"]'))) && !S.reviews.length);
    await o.page.locator('[data-case-field="right"]').fill("Извиниться, предложить плед и первый освободившийся стол");
    await o.page.locator('[data-case-field="wrong1"]').fill("Позвать менеджера и уйти");
    await o.page.locator('[data-case-field="why"]').fill("Гостю важно, что о нём позаботились сейчас и не забыли потом.");
    await o.page.locator('[data-case-field="note"]').fill("Спасибо, хороший пример");
    await shot(o.page, "review-form" + (light ? "-light" : ""));
    await o.page.locator("[data-case-publish]").click(); await sleep(900);
    const rv = S.reviews[0] || {}, s = rv.p_sit || {};
    ok(tag + ": case_review publish — сцена, верный первым, неверные, разбор, как было, автор виден, слово автору",
      rv.p_action === "publish" && rv.p_id === 41 && s.scene === INBOX[0].story && s.correct === 0 && JSON.stringify(s.options) === JSON.stringify(["Извиниться, предложить плед и первый освободившийся стол", "Сказала, что мест нет, и ушла.", "Позвать менеджера и уйти"])
      && /^Гостю важно/.test(s.why) && /^Что сделали:/.test(s.real) && s.show_author === true && rv.p_note === "Спасибо, хороший пример", JSON.stringify(rv).slice(0, 300));
    ok(tag + ": «Опубликовано: случай в тренировке команды», в списке 1 ждёт, в разобранных 1", /Опубликовано: случай в тренировке команды\./.test(await txt(o.page.locator('[role="status"]')))
      && (await o.page.locator("[data-case-inbox]").count()) === 1 && (await o.page.locator('[data-case-done="41"]').getAttribute("data-status")) === "published");
    // «не для тренировки» с ответом
    await o.page.locator('[data-case-inbox="42"]').click(); await sleep(500);
    ok(tag + ": «без имени»: переключатель автора выключен и недоступен", (await o.page.locator('[data-case-toggle="author"]').getAttribute("aria-checked")) === "false" && await o.page.locator('[data-case-toggle="author"]').isDisabled());
    await o.page.locator("[data-case-decline]").click(); await sleep(200);
    await o.page.locator('[data-case-field="note"]').fill("Спасибо. Такой мохито в карту не берём.");
    await o.page.locator("[data-case-decline-send]").click(); await sleep(900);
    const rv2 = S.reviews[1] || {};
    ok(tag + ": «Не для тренировки» → case_review decline с ответом автору", rv2.p_action === "decline" && rv2.p_id === 42 && rv2.p_note === "Спасибо. Такой мохито в карту не берём." && !rv2.p_sit
      && /Ответ автору отправлен/.test(await txt(o.page.locator('[role="status"]'))), JSON.stringify(rv2));
    ok(tag + ": новых нет; в разобранных — оба", /Новых случаев нет\./.test(await txt(o.page.locator("body"))) && (await o.page.locator("[data-case-done]").count()) === 2);
    await shot(o.page, "review-done" + (light ? "-light" : ""));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("PLAY")) {
  const S = caseServer({ team: TEAM });
  const o = await open({ who: STAFF, rpcs: S.rpc, seedExtra: { ["sa_cases_played" + ukOf(STAFF)]: JSON.stringify({ 33: 1 }) } });
  await sleep(1200); await toShift(o.page);
  const it = await txt(item(o.page));
  ok("PLAY: в пункте — «2 новых случая» и «новое» (свой не новый)", /2 новых случая новое/.test(it), it);
  await item(o.page).first().click(); await sleep(1800);
  const since = await o.page.evaluate((uk) => localStorage.getItem("sa_cases_since" + uk), o.UK);
  ok("PLAY: открыл экран — отметка «смотрел» на телефоне", !!since, String(since));
  const train = await txt(o.page.locator("[data-case-train]"));
  ok("PLAY: «3 случая из зала · новых для тебя 2»", /3 случая из зала · новых для тебя 2/.test(train) && /Разобрать новые/.test(train), train);
  await shot(o.page, "play-screen");
  await o.page.locator("[data-case-play]").click(); await sleep(1500);
  const head = await txt(o.page.locator(".tb .tb-host-t"));
  ok("PLAY: «стол» в режиме случаев: заголовок и заведение", /Случаи из нашего зала/.test(head) && /Два моря, Океан · 3 случая/.test(head), head);
  const sc1 = await txt(o.page.locator(".tb .tb-scene"));
  ok("PLAY: первым — несыгранный свежий случай", sc1.includes(TEAM[0].sit.scene), sc1);
  // первый — неверно
  await o.page.locator(".tb .tb-actc", { hasText: "Сказать, что такого нет" }).first().click(); await sleep(1600);
  const note1 = await txt(o.page.locator(".tb"));
  // v87: «как было у нас» и подпись рассказчика — плашкой [data-case-real] (раньше одним абзацем с разбором)
  ok("PLAY: после ответа — как правильно, разбор, «как было у нас», кто рассказал", note1.includes("Лучше так") && note1.includes(TEAM[0].sit.options[0]) && /Как было у нас Предложили «Апероль шприц» вместо «Хьюго», гость заказал второй\./.test(note1) && /рассказал\(а\) Илья Бармен/.test(note1) && (await o.page.locator(".tb [data-case-real]").count()) === 1, note1.slice(-420));
  await shot(o.page, "play-note");
  let steps = 1;
  for (let i = 0; i < 6; i++) {
    const foot = o.page.locator(".tb .tb-foot .tb-main");
    if (await o.page.locator(".tb .tb-receipt").count()) break;
    if (await foot.count()) { await foot.first().click(); await sleep(900); }
    if (await o.page.locator(".tb .tb-receipt").count()) break;
    const sc = await txt(o.page.locator(".tb .tb-scene"));
    const t = TEAM.find((x) => sc.includes(x.sit.scene));
    if (t) { await o.page.locator(".tb .tb-actc", { hasText: t.sit.options[0].slice(0, 25) }).first().click(); await sleep(1500); steps++; }
    else {   // повтор из «Работы над ошибками» — любым вариантом
      const any = o.page.locator(".tb .tb-actc").first(); if (await any.count()) { await any.click(); await sleep(1500); steps++; }
    }
  }
  const rc = await txt(o.page.locator(".tb .tb-receipt"));
  ok("PLAY: итог — «Случаи разобраны», верно 2 из 3, одна — в «Работу над ошибками»", /Случаи разобраны/.test(rc) && /Верно с первого раза 2 из 3/.test(rc) && /В «Работу над ошибками» 1/.test(rc), rc.slice(0, 260));
  await shot(o.page, "play-receipt");
  await o.page.locator(".tb .tb-foot .tb-main").first().click(); await sleep(700);
  const st = await o.page.evaluate((uk) => ({ played: JSON.parse(localStorage.getItem("sa_cases_played" + uk) || "{}"), bank: JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]") }), o.UK);
  const mb = st.bank.find((m) => m.lessonId === "case-31");
  ok("PLAY: сыгранные запомнены (31, 32, 33)", !!(st.played[31] && st.played[32] && st.played[33]), JSON.stringify(st.played));
  ok("PLAY: ошибка — в банке под темой «Случаи из нашего зала» (lessonId case-31)", !!mb && mb.lessonTitle === "Случаи из нашего зала" && mb.options.includes(TEAM[0].sit.options[0]), JSON.stringify(st.bank.map((m) => [m.lessonId, m.lessonTitle])));
  const tr2 = await txt(o.page.locator("[data-case-train]"));
  ok("PLAY: на экране — «Разобрать ещё раз», новых нет", /Разобрать ещё раз/.test(tr2) && !/новых для тебя/.test(tr2), tr2);
  ok("PLAY: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("BRIEF")) {
  const S = caseServer({ lead: true, team: TEAM });
  let published = null;
  const o = await open({ who: LEAD, rpcs: (fn, body) => {
    if (fn === "brief_publish") { published = body; return { ok: true, sent: 0, again: false, bot: true }; }
    if (fn === "quiz_hard_questions") return [];
    if (fn === "league_week") return { ok: true, rows: [] };
    return S.rpc(fn, body);
  } });
  await sleep(1200);
  await o.page.evaluate(() => window.__saNav("brief")); await sleep(2600);
  const b = await txt(o.page.locator('[data-brief-block="case"]'));
  ok("BRIEF: блок «Случай из зала» — свежий опубликованный: сцена, вопрос, варианты, как было, кто рассказал", b.includes(TEAM[0].sit.scene) && /Как поступить\?/.test(b) && /А\. Предложить похожий/.test(b)
    && /Как было у нас Предложили «Апероль шприц» вместо «Хьюго», гость заказал второй\./.test(b) && /рассказал\(а\) Илья Бармен/.test(b) && (await o.page.locator('[data-brief-block="case"] [data-brief-real]').count()) === 1   // v87: плашкой с подписью
    && (await o.page.locator('[data-brief-block="case"]').getAttribute("data-on")) === "1", b.slice(0, 200));
  await o.page.locator("[data-brief-present]").click(); await sleep(400);
  const show = o.page.locator("[data-brief-show]");
  for (let i = 0; i < 8; i++) { if ((await show.locator("[data-brief-page]").getAttribute("data-brief-page")) === "case") break; await show.locator("[data-brief-next]").click(); await sleep(200); }
  const p1 = await txt(show);
  ok("BRIEF: в показе — ответ и «как было» по кнопке", (await show.locator("[data-brief-page]").getAttribute("data-brief-page")) === "case" && /Показать ответ/.test(p1) && !/Как было у нас/.test(p1));
  await show.locator("[data-brief-reveal]").click(); await sleep(250);
  ok("BRIEF: «Показать ответ» — разбор и «как было у нас»", /Как было у нас Предложили/.test(await txt(show)) && /Гость пришёл за вкусом/.test(await txt(show)));
  await shot(o.page, "brief-case");
  await show.locator("[data-sa-back]").click(); await sleep(300);
  await o.page.locator("[data-brief-publish]").click(); await sleep(900);
  const tx = String((published && published.p_text) || "");
  ok("BRIEF: текст для Telegram — «Случай из зала: «…» Как поступить? Разбор в приложении.», без ответа", tx.includes("Случай из зала: «" + TEAM[0].sit.scene + "» Как поступить? Разбор в приложении.") && !tx.includes("Апероль"), tx.slice(-220));
  ok("BRIEF: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("LINK")) {
  const S = caseServer({ team: TEAM });
  const o = await open({ who: STAFF, path: "/?go=cases", rpcs: S.rpc });
  await sleep(2500);
  ok("LINK: ?go=cases — экран «Случаи из нашего зала»", /Случаи из нашего зала/.test(await txt(o.page.locator("body"))) && (await o.page.locator("[data-case-train]").count()) === 1);
  ok("LINK: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("MISSING")) {
  const miss = { code: "PGRST202", message: "Could not find the function" };
  const o = await open({ who: STAFF, rpcs: (fn) => (/^case_/.test(fn) ? miss : undefined) });
  await sleep(1200); await toShift(o.page); await sleep(600);
  ok("MISSING: нет этапа 33 — пункта «Случаи из нашего зала» нет", !(await item(o.page).count()) && (await o.page.locator('.sa-card[aria-label="Задание дня"]').count()) === 1);
  await o.page.evaluate(() => window.__saNav("cases")); await sleep(1500);
  ok("MISSING: экран (открытый напрямую) — «На сервере ещё нет этапа 33»", /На сервере ещё нет этапа 33 \(supabase-stage33-cases\.sql\)/.test(await txt(o.page.locator("body"))));
  ok("MISSING: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("PREFS")) {
  let prefs = { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true, qday: true, qday_hour: 12, brief: true, cases: true };
  const o = await open({ who: STAFF, telegram: true, rpcs: (fn, body) => {
    if (fn === "tg_status") return { ok: true, bot: true, linked: true, remind: true, minutes: 60 };
    if (fn === "notify_prefs") return prefs;
    if (fn === "notify_set") { prefs = { ...prefs, [body.p_kind]: !!body.p_on }; return prefs; }
    if (fn === "case_list") return { ok: true, lead: false, team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null };
    return undefined;
  } });
  await sleep(1500); await toShift(o.page);
  await o.page.locator('.sa-card[aria-label="Напоминания в Telegram"]').first().click(); await sleep(1400);
  const row = o.page.locator('[data-notify-prefs] [role="switch"]', { hasText: "Случаи из зала" });
  const t = await txt(row);
  // v86: строки группами — «Случаи из зала» в группе «Смена»
  ok("PREFS: строка «Случаи из зала» — в группе «Смена», включена", /Случаи из зала когда разобрали твой случай, а старшим о новых случаях/.test(t) && (await row.getAttribute("aria-checked")) === "true"
    && (await o.page.locator('[data-notify-group="shift"] [role="switch"]', { hasText: "Случаи из зала" }).count()) === 1, t);
  await row.click(); await sleep(700);
  const set = o.calls.filter((c) => c.fn === "notify_set").map((c) => c.body);
  ok("PREFS: переключатель — notify_set cases выкл", set.length === 1 && set[0].p_kind === "cases" && set[0].p_on === false, JSON.stringify(set));
  ok("PREFS: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("NARROW")) {
  const S = caseServer({ lead: true, inbox: INBOX, team: TEAM });
  const o = await open({ who: LEAD, w: 320, h: 640, rpcs: S.rpc });
  await sleep(1200);
  await o.page.evaluate(() => window.__saNav("cases")); await sleep(1800);
  const fit = () => o.page.evaluate(() => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll("[data-case-train], [data-case-inbox], [data-case-review] *, [data-case-done]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length; return { W, sw: document.documentElement.scrollWidth, over }; });
  const a = await fit();
  ok("NARROW: 320 px — экран случаев без прокрутки вбок", a.sw <= a.W && a.over === 0, JSON.stringify(a));
  await o.page.locator('[data-case-inbox="41"]').click(); await sleep(500);
  const b = await fit();
  ok("NARROW: 320 px — разбор без прокрутки вбок", b.sw <= b.W && b.over === 0, JSON.stringify(b));
  await shot(o.page, "narrow-review");
  ok("NARROW: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
