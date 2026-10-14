// v37 (Доп. 348–350): «Живой диалог» — ВСЕ штатные сценарии (data/dialogues.js) проходятся до конца
// в стенде tools/claude/dlg-stand.jsx (один экран переписки, тот же компонент LiveDialogue, что в уроках
// хостес, в поппапах терминов у официанта и менеджера и в «Госте недели»).
//
// Проходы (каждый — по всем сценариям):
//   ok  — урок (pro): все ответы верные — звёзды, «Дальше», onClose(true);
//   bad — урок (pro): все ответы неверные, самые резкие — гость уходит (плашка 🚪, «Без отзыва», «Закрыть»);
//   mix — поппап термина / гость недели (без звёзд): через один, светлая тема.
// Переписка сверяется с моделью сценария (как его играет движок): реплики гостя и плашки (next / goto),
// твои реплики, реакция гостя, шёпот наставника (✓/✗, текст разбора, «Лучше так» только в уроке при ошибке),
// уход гостя, отзыв (настроение / ушёл), звёзды, «N из M правильных», итог наставника, кнопки в конце.
// На каждом вопросе: «N из M», вопрос, все варианты на месте, последняя реплика видна над панелью ответов.
// В конце — отзыв и итог не спрятаны под кнопками. Без ошибок в консоли.
//   MO  — плавность (покадрово, rAF): лента едет одним движением — без разворотов и прыжков,
//         в обычном темпе и когда торопят нажатиями на переписку.
//   AG  — «Ещё раз» и «Назад» посреди разговора.
//
// Запуск: node tools/claude/dlg-sweep.mjs [путь к проекту] [ok bad mix MO AG] ; ONLY=id1,id2 — только эти сценарии
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const { chromium } = require(G + "/playwright");
const esbuild = (() => { for (const p of [G + "/tsx/node_modules/esbuild", "/opt/npm-tools/node_modules/esbuild", G + "/esbuild"]) { try { return require(p); } catch (e) {} } throw new Error("esbuild не найден"); })();

const args = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(args.find((a) => a.includes("/")) || process.env.SRC
  || (existsSync(here + "/../../ui/screens-dialogue.jsx") ? here + "/../.." : "/home/claude/work/service-academy"));
const only = args.filter((a) => !a.includes("/"));
const want = (t) => !only.length || only.includes(t);
const OUT = "/home/claude/preview/dlg-stand", PORT = 5730 + Math.floor(Math.random() * 60);
const WORKERS = Number(process.env.WORKERS || 6);

// ── стенд ──
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
await esbuild.build({
  entryPoints: [SRC + "/tools/claude/dlg-stand.jsx"], bundle: true, format: "esm", outfile: OUT + "/app.js",
  jsx: "automatic", nodePaths: [G], platform: "browser", target: "es2020", define: { "process.env.NODE_ENV": '"development"' }, logLevel: "warning",
  plugins: [{ name: "sa", setup(b) { b.onResolve({ filter: /^@sa\// }, (a) => ({ path: join(SRC, a.path.slice(4)) })); } }],
});
writeFileSync(OUT + "/index.html", `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><title>Живой диалог</title></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`);
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(OUT, p); try { if (!statSync(f).isFile()) f = join(OUT, "index.html"); } catch (e) { f = join(OUT, "index.html"); } res.writeHead(200, { "Content-Type": extname(f) === ".js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8" }); res.end(readFileSync(f)); });
await new Promise((r) => server.listen(PORT, r));

const { DIALOGUES_DATA } = await import(SRC + "/data/dialogues.js");
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const DLG = DIALOGUES_DATA.filter((d) => !ONLY.length || ONLY.includes(d.id));
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); return cond; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

// ── модель: как движок играет сценарий при данных ответах (play / choose / finish) ──
// Написана заново, не копией кода: настроение — правило v36 (прибавить moodDelta, удержать в 1…5);
// копия clampMood из компонента однажды пропустила ошибку «0 → 3» (ревью v37)
const clampMood = (m) => Math.max(1, Math.min(5, m));
// «N из M»: M — уже отвеченные + выборы впереди по пути верных ответов (с текущим)
function pathChoices(steps, from) {
  const at = (sid) => (sid === "result" ? steps.findIndex((s) => s.type === "result") : steps.findIndex((s) => s.id === sid));
  let i = from, n = 0; const seen = new Set();
  while (steps[i] && steps[i].type !== "result" && !seen.has(i)) {
    const s = steps[i]; seen.add(i);
    if (s.type === "choice" && s.options && s.options.length) { n++; const o = s.options.find((x) => x.correct); i = o && o.goto ? at(o.goto) : i + 1; }
    else i = s.type !== "choice" && s.next ? at(s.next) : i + 1;
  }
  return n;
}
const quoteOf = (t) => (/[«»]/.test(t) ? t : "«" + t + "»");
function model(D, picks, pro) {
  const steps = D.steps, out = [], asks = [];
  let mood = clampMood((D.guest && D.guest.mood) || 3), score = 0, faced = 0, walked = false, i = 0, p = 0;
  const at = (sid) => (sid === "result" ? steps.findIndex((s) => s.type === "result") : steps.findIndex((s) => s.id === sid));
  const play = () => {
    for (let guard = 0; guard < 300; guard++) {
      const s = steps[i];
      if (!s || s.type === "result") return "finish";
      if (s.type === "choice") { if (Array.isArray(s.options) && s.options.length) return "ask"; i += 1; continue; }
      if (s.type === "guest") out.push(["guest", s.text]);
      else if (s.type === "action" && s.text) out.push(["action", s.text]);
      i = s.next ? at(s.next) : i + 1;
    }
    return "finish";
  };
  let st = play();
  while (st === "ask") {
    const step = steps[i]; asks.push(i);
    const opt = picks[p++];
    if (!opt) return { out, asks, incomplete: true };
    out.push(["me", opt.text]);
    const nm = clampMood(mood + (Number(opt.moodDelta) || 0));
    if (opt.correct) score += 1;
    faced += 1; mood = nm;
    const best = pro && !opt.correct ? ((step.options.find((o) => o.correct) || {}).text || null) : null;
    out.push(["coach", opt.correct ? "ok" : "bad", opt.feedback || "", best ? quoteOf(best) : null]);
    if (opt.reaction) out.push(["guest", opt.reaction]);
    if (pro && nm <= 1 && !opt.correct && !opt.goto) { out.push(["walk"]); walked = true; break; }
    const next = opt.goto ? at(opt.goto) : i + 1;
    if (next < 0 || !steps[next] || steps[next].type === "result") break;
    i = next; st = play();
  }
  out.push(["review", walked ? "walked" : String(mood)]);
  return { out, asks, walked, score, faced, mood, tipRaw: (steps.find((s) => s.type === "result") || {}).tip };
}

// что сейчас в переписке (сверху вниз)
const FEED = () => [...document.querySelectorAll(".dc-feed > .dc-row")].map((r) => {
  const k = r.getAttribute("data-dlg-msg"), rv = r.getAttribute("data-dlg-review");
  const tx = (sel) => { const e = r.querySelector(sel); return e ? e.textContent : null; };
  if (rv !== null) {
    const st = r.querySelector(".dc-stars");
    return ["review", rv, st ? st.getAttribute("aria-label") : null, tx(".dc-rv-s"), tx(".dc-ey"), tx(".dc-rv-t")];
  }
  if (r.hasAttribute("data-dlg-typing")) return ["typing"];
  if (k === "intro") return ["intro", tx(".dc-ey"), tx(".dc-intro-n"), [...r.querySelectorAll(".dc-chip")].map((c) => c.textContent)];
  if (k === "guest") return ["guest", tx(".dc-tx")];
  if (k === "me") { const re = r.querySelector("[data-dlg-react]"); const b = r.querySelector(".dc-b"); return ["me", tx(".dc-tx"), re ? re.getAttribute("data-dlg-react") : null, b.classList.contains("miss"), b.classList.contains("read")]; }
  if (k === "coach") { const best = r.querySelector(".dc-best b"); return ["coach", r.getAttribute("data-dlg-mentor"), tx(".dc-coach p"), best ? best.textContent : null, tx(".dc-verdict")]; }
  if (k === "action") return ["action", tx(".dc-svc")];
  if (k === "walk") return ["walk", tx(".dc-svc")];
  if (k === "tip") return ["tip", tx(".dc-coach p")];
  return ["?", r.className];
});
// панель ответов доехала и лента стоит: последняя реплика целиком над панелью?
const SETTLED = () => {
  const pane = document.querySelector(".dc-pane"), feed = document.querySelector(".dc-feed");
  if (!pane || !feed) return false;
  const t = getComputedStyle(pane).transform;
  const still = (!t || t === "none" || /matrix\(1, 0, 0, 1, 0, 0\)/.test(t)) && !feed.getAnimations().length && !pane.getAnimations().length;
  return still;
};
const ABOVE = () => {
  const rows = [...document.querySelectorAll(".dc-feed > .dc-row")];
  const last = rows[rows.length - 1], box = document.querySelector(".dc-pane-box"), chat = document.querySelector(".dc-chat");
  if (!last || !box) return { ok: false, why: "нет строк или панели" };
  const lb = last.getBoundingClientRect().bottom, bt = box.getBoundingClientRect().top, ct = chat.getBoundingClientRect().top;
  const lt = last.getBoundingClientRect().top;
  return { ok: lb <= bt + 1.5 && lt >= ct - 1.5, lb: Math.round(lb), bt: Math.round(bt), lt: Math.round(lt), ct: Math.round(ct), wide: document.documentElement.scrollWidth <= innerWidth + 1 };
};

async function run(page, D, mode) {
  const pro = mode !== "mix", theme = mode === "mix" ? "light" : "dark";
  const errs = [];
  const onErr = (e) => errs.push("pageerror: " + e.message);
  const onCon = (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); };
  page.on("pageerror", onErr); page.on("console", onCon);
  const tag = `${mode}:${D.id}`;
  const fails = [];
  const bad = (what) => { fails.push(what); };
  try {
    await page.goto(`http://localhost:${PORT}/?id=${encodeURIComponent(D.id)}&pro=${pro ? 1 : 0}&theme=${theme}&seed=${11 + D.id.length}`, { waitUntil: "load" });
    await page.waitForSelector("[data-dlg-msg=intro]", { timeout: 10000 });
    // торопим: нажатие на переписку заканчивает паузы (как пальцем)
    await page.evaluate(() => { window.__tap = setInterval(() => { const c = document.querySelector(".dc-chat"); if (c) c.click(); }, 90); });
    const intro = (await page.evaluate(FEED))[0];
    const total = D.steps.filter((s) => s.type === "choice").length;
    if (!(intro && intro[0] === "intro" && intro[2] === String((D.guest && D.guest.name) || "Гость"))) bad("карточка гостя: " + JSON.stringify(intro));
    if (pro !== intro[3].some((c) => c === "★ до 3 звёзд")) bad("звёзды в карточке: " + JSON.stringify(intro[3]));
    const chipN = pathChoices(D.steps, 0);
    if (chipN && !intro[3].some((c) => c.startsWith(chipN + " выбор"))) bad(`в карточке не «${chipN} выбор…»: ` + JSON.stringify(intro[3]));
    const picks = [], seen = [];
    for (let n = 0; n < 40; n++) {
      await page.waitForSelector("[data-dlg-reply]:not([disabled]), [data-dlg-next]", { timeout: 20000 });
      if (await page.locator("[data-dlg-next]").count()) break;
      const idx = Number(await page.getAttribute("[data-dlg-kb]", "data-dlg-kb"));
      const step = D.steps[idx];
      seen.push(idx);
      if (!step || step.type !== "choice") { bad("панель ответов на шаге " + idx + " — не выбор"); break; }
      // панель доехала: последняя реплика видна над ней, «N из M», вопрос, все варианты
      await page.waitForFunction(SETTLED, null, { timeout: 4000 }).catch(() => bad("панель не встала"));
      const kb = await page.evaluate(() => ({
        n: (document.querySelector(".dc-kb-n") || {}).textContent, q: (document.querySelector("[data-dlg-q]") || {}).textContent || null,
        opts: [...document.querySelectorAll("[data-dlg-reply]")].map((b) => b.querySelector(".dc-opt-t").textContent),
        fits: [...document.querySelectorAll("[data-dlg-reply]")].every((b) => { const r = b.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5; }),
      }));
      const above = await page.evaluate(ABOVE);
      if (!above.ok) bad(`вопрос ${n + 1}: последняя реплика не над панелью ${JSON.stringify(above)}`);
      if (!above.wide) bad("горизонтальная прокрутка");
      const wantN = `${n + 1} из ${n + pathChoices(D.steps, idx)}`;
      if (kb.n !== wantN) bad(`счётчик «${kb.n}» ≠ «${wantN}»`);
      if ((kb.q || null) !== (step.prompt || null)) bad(`вопрос «${kb.q}» ≠ «${step.prompt}»`);
      const want = step.options.map((o) => o.text).slice().sort().join("\n"), got = kb.opts.slice().sort().join("\n");
      if (want !== got) bad("варианты не совпали на шаге " + idx);
      if (!kb.fits) bad("кнопка ответа шире экрана");
      // выбор по проходу
      let opt;
      if (mode === "ok") opt = step.options.find((o) => o.correct);
      else if (mode === "bad") opt = step.options.filter((o) => !o.correct).sort((a, b) => (Number(a.moodDelta) || 0) - (Number(b.moodDelta) || 0))[0];
      else opt = n % 2 === 0 ? step.options.find((o) => !o.correct) : step.options.find((o) => o.correct);
      if (!opt) { bad("нет варианта для прохода на шаге " + idx); opt = step.options[0]; }
      picks.push(opt);
      const j = kb.opts.indexOf(opt.text);
      await page.locator(`[data-dlg-reply="${j}"]`).click();
      // нажатая кнопка: остальные гаснут, повторно не жмутся
      const dis = await page.evaluate(() => [...document.querySelectorAll("[data-dlg-reply]")].every((b) => b.disabled));
      if (!dis) bad("после ответа кнопки не погасли");
    }
    await page.waitForSelector("[data-dlg-next]", { timeout: 20000 });
    await page.waitForFunction(SETTLED, null, { timeout: 4000 }).catch(() => bad("панель итога не встала"));
    await page.evaluate(() => clearInterval(window.__tap));
    const M = model(D, picks, pro);
    if (M.incomplete) bad("модель ждёт ещё ответ — движок закончил раньше");
    if (JSON.stringify(M.asks) !== JSON.stringify(seen)) bad(`порядок вопросов ${JSON.stringify(seen)} ≠ модель ${JSON.stringify(M.asks)}`);
    const feed = await page.evaluate(FEED);
    const helpers = await page.evaluate(([picks, walked, score, den, mood, tipRaw, guest]) => {
      const D = window.__dlg, name = String(guest.name || "Гость"), g = D.dlgGram(name);
      return { react: picks.map((o) => D.dlgReaction(o)), stars: D.dlgStars({ walkedOut: walked, score, den, mood }), tip: D.dlgTip(tipRaw), walk: D.dlgWalkLine(guest), word: D.DLG_MOOD_WORDS[mood - 1],
        gone: (guest.walkTitle || "").trim() || name + " " + (g === "pl" ? "ушли" : g === "f" ? "ушла" : "ушёл") };
    }, [picks, M.walked, M.score, M.faced || total, M.mood, M.tipRaw || "", D.guest || {}]);
    // сверка переписки с моделью
    const body = feed.slice(1);
    if (body.some((r) => r[0] === "typing")) bad("в конце висит «печатает…»");
    let k = 0, meN = 0;
    for (const e of M.out) {
      const r = body[k++];
      if (!r) { bad("не хватает строки: " + JSON.stringify(e).slice(0, 120)); break; }
      if (e[0] === "guest" || e[0] === "action") { if (r[0] !== e[0] || r[1] !== e[1]) { bad(`строка ${k}: ждали ${e[0]} «${String(e[1]).slice(0, 50)}», а там ${r[0]} «${String(r[1]).slice(0, 50)}»`); break; } }
      else if (e[0] === "me") {
        const o = picks[meN];
        if (r[0] !== "me" || r[1] !== e[1]) { bad(`строка ${k}: моя реплика не та`); break; }
        if (r[2] !== helpers.react[meN]) bad(`реакция ${r[2]} ≠ ${helpers.react[meN]}`);
        if (r[3] !== !o.correct) bad("пузырь ошибки помечен не так");
        if (!r[4]) bad("моя реплика не «прочитана»");
        meN += 1;
      } else if (e[0] === "coach") {
        if (r[0] !== "coach" || r[1] !== e[1] || r[2] !== e[2] || (r[3] || null) !== (e[3] || null)) { bad(`строка ${k}: шёпот наставника ${JSON.stringify(r).slice(0, 160)} ≠ ${JSON.stringify(e).slice(0, 160)}`); break; }
        if (r[4] !== (e[1] === "ok" ? "✓ верно" : "✗ неверно")) bad("вердикт наставника: " + r[4]);
      } else if (e[0] === "walk") {
        if (r[0] !== "walk" || !String(r[1]).includes(helpers.walk)) { bad(`строка ${k}: нет ухода гостя (${JSON.stringify(r).slice(0, 100)})`); break; }
        if (D.guest && D.guest.walk && String(r[1]) !== "🚪 " + D.guest.walk) bad("своя фраза ухода не показана: " + r[1]);
      } else if (e[0] === "review") {
        if (r[0] !== "review" || r[1] !== e[1]) { bad(`отзыв ${JSON.stringify(r)} ≠ ${e[1]}`); break; }
        const den = M.faced || total;
        if (r[3] !== `${M.score} из ${den} правильных ответов`) bad("счёт в отзыве: " + r[3]);
        if (pro && r[2] !== `${helpers.stars} из 3 звёзд`) bad("звёзды: " + r[2] + " ≠ " + helpers.stars);
        if (!pro && r[2] !== null) bad("звёзды вне урока");
        if (r[4] !== (M.walked ? "Без отзыва" : "Отзыв гостя")) bad("шапка отзыва: " + r[4]);
        if (!M.walked && r[5] !== String((D.guest && D.guest.name) || "Гость") + " " + helpers.word) bad("заголовок отзыва: " + r[5]);
        if (M.walked && r[5] !== helpers.gone) bad(`заголовок ухода «${r[5]}» ≠ «${helpers.gone}»`);
      }
    }
    const rest = body.slice(k);
    if (helpers.tip) { if (!(rest.length === 1 && rest[0][0] === "tip" && rest[0][1] === helpers.tip)) bad("итог наставника: " + JSON.stringify(rest).slice(0, 160)); }
    else if (rest.length) bad("лишние строки: " + JSON.stringify(rest).slice(0, 160));
    // шапка: настроение в конце; кнопки; отзыв и итог видны над кнопками
    const end = await page.evaluate(() => ({ st: document.querySelector("[data-dlg-status]").getAttribute("data-dlg-status"), next: document.querySelector("[data-dlg-next]").textContent, again: !!document.querySelector("[data-dlg-again]") }));
    if (end.st !== String(M.mood)) bad(`шапка: настроение ${end.st} ≠ ${M.mood}`);
    if (end.next !== (M.walked ? "Закрыть" : "Дальше") || !end.again) bad("кнопки в конце: " + JSON.stringify(end));
    const above = await page.evaluate(ABOVE);
    if (!above.ok) bad("итог спрятан под кнопками: " + JSON.stringify(above));
    await page.locator("[data-dlg-next]").click();
    await page.waitForSelector("#closed", { timeout: 4000 });
    const [closed, info] = await page.evaluate(() => [window.__closed, window.__closeInfo]);
    if (closed !== !M.walked) bad(`onClose(${closed}) — ждали ${!M.walked}`);
    if (!info || info.done !== true || info.walkedOut !== M.walked) bad("onClose: второй аргумент " + JSON.stringify(info));
    return { tag, fails, errs, walked: M.walked, asks: seen.length, score: M.score, mood: M.mood };
  } catch (e) {
    fails.push("исключение: " + String(e.message || e).split("\n")[0]);
    return { tag, fails, errs };
  } finally {
    page.off("pageerror", onErr); page.off("console", onCon);
  }
}

async function pool(tasks, fn) {
  const out = []; let next = 0;
  const workers = await Promise.all(Array.from({ length: Math.min(WORKERS, tasks.length) }, async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    return { ctx, page: await ctx.newPage() };
  }));
  await Promise.all(workers.map(async (w) => { while (next < tasks.length) { const t = tasks[next++]; out.push(await fn(w.page, t)); } }));
  await Promise.all(workers.map((w) => w.ctx.close()));
  return out;
}

const t0 = Date.now();
for (const mode of ["ok", "bad", "mix"]) {
  if (!want(mode)) continue;
  const res = await pool(DLG, (page, D) => run(page, D, mode));
  const fails = res.filter((r) => r.fails.length || r.errs.length);
  const walked = res.filter((r) => r.walked).length;
  ok(`${mode}: ${res.length} сценариев до конца — переписка совпала с моделью, кнопки, отзыв, onClose` + (mode === "bad" ? ` (гость ушёл в ${walked})` : ""), fails.length === 0,
    fails.slice(0, 6).map((r) => r.tag + ": " + [...r.fails, ...r.errs].slice(0, 3).join("; ")).join(" | "));
  if (mode === "ok") ok("ok: никто не ушёл, во всех — «Дальше»", walked === 0);
  if (mode === "bad") ok("bad: уход гостя встречается (урок, настроение ≤ 1 после ошибки)", walked > 0, String(walked));
}

// ── AG. «Ещё раз» и «Назад» посреди разговора ──
if (want("AG")) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const D = DIALOGUES_DATA.find((d) => d.id === "anticipation");
  await page.goto(`http://localhost:${PORT}/?id=anticipation&pro=1&seed=5`);
  await page.waitForSelector("[data-dlg-msg=intro]");
  await page.evaluate(() => { window.__tap = setInterval(() => { const c = document.querySelector(".dc-chat"); if (c) c.click(); }, 90); });
  for (;;) {
    await page.waitForSelector("[data-dlg-reply]:not([disabled]), [data-dlg-next]", { timeout: 20000 });
    if (await page.locator("[data-dlg-next]").count()) break;
    const idx = Number(await page.getAttribute("[data-dlg-kb]", "data-dlg-kb"));
    const o = D.steps[idx].options.find((x) => x.correct);
    await page.locator("[data-dlg-reply]").filter({ hasText: o.text }).first().click();
  }
  await page.locator("[data-dlg-again]").click();
  await page.waitForSelector("[data-dlg-reply]:not([disabled])", { timeout: 20000 });
  const s = await page.evaluate(() => ({ rows: [...document.querySelectorAll(".dc-feed > .dc-row")].map((r) => r.getAttribute("data-dlg-msg") || (r.hasAttribute("data-dlg-review") ? "review" : "?")), n: document.querySelector(".dc-kb-n").textContent, st: document.querySelector("[data-dlg-status]").getAttribute("data-dlg-status") }));
  ok("AG: «Ещё раз» — переписка с начала (без отзыва и моих реплик), «1 из N», настроение — исходное",
    s.rows[0] === "intro" && !s.rows.includes("review") && !s.rows.includes("me") && /^1 из \d+$/.test(s.n) && s.st === String(D.guest.mood || 3), JSON.stringify(s));
  await page.locator("[data-sa-back]").click();
  await page.waitForSelector("#closed", { timeout: 4000 });
  const ag = await page.evaluate(() => [window.__closed, window.__closeInfo]);
  ok("AG: «Назад» посреди разговора — onClose(false, { done: false }) — урок не засчитает", ag[0] === false && ag[1] && ag[1].done === false && ag[1].walkedOut === false, JSON.stringify(ag));
  ok("AG: без ошибок", errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

// ── MO. Плавность: покадровый след карточки гостя (вся лента едет вместе с ней) ──
if (want("MO")) {
  const trace = async (id, plan, hurry) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    const D = DIALOGUES_DATA.find((d) => d.id === id);
    await page.goto(`http://localhost:${PORT}/?id=${id}&pro=1&seed=3`);
    await page.waitForSelector("[data-dlg-msg=intro]");
    await page.evaluate((hurry) => {
      window.__trace = [];
      const tick = (t) => { const i = document.querySelector("[data-dlg-msg=intro]"); if (i) window.__trace.push([t, i.getBoundingClientRect().top]); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      if (hurry) window.__tap = setInterval(() => { const c = document.querySelector(".dc-chat"); if (c) c.click(); }, 140);
    }, hurry);
    for (let n = 0; n < 40; n++) {
      const k = plan[n] || "ok";   // план кончился — дальше верные ответы до конца разговора
      await page.waitForSelector("[data-dlg-reply]:not([disabled]), [data-dlg-next]", { timeout: 30000 });
      if (await page.locator("[data-dlg-next]").count()) break;
      await sleep(450);
      const idx = Number(await page.getAttribute("[data-dlg-kb]", "data-dlg-kb"));
      const o = D.steps[idx].options.find((x) => (k === "ok" ? x.correct : !x.correct));
      await page.locator("[data-dlg-reply]").filter({ hasText: o.text }).first().click();
    }
    await page.waitForSelector("[data-dlg-next]", { timeout: 30000 });
    await sleep(800);
    const tr = await page.evaluate(() => window.__trace);
    await ctx.close();
    let reversals = 0, jumps = 0, moves = 0, lastDir = 0, lastMoveT = -1e9, maxStep = 0, path = 0;
    for (let i = 1; i < tr.length; i++) {
      const dy = tr[i][1] - tr[i - 1][1];
      if (Math.abs(dy) < 0.5) continue;
      moves++; path += Math.abs(dy); maxStep = Math.max(maxStep, Math.abs(dy));
      const dir = Math.sign(dy);
      if (lastDir && dir !== lastDir && tr[i][0] - lastMoveT < 120) reversals++;
      const prev = i > 1 ? Math.abs(tr[i - 1][1] - tr[i - 2][1]) : 0, next = i + 1 < tr.length ? Math.abs(tr[i + 1][1] - tr[i][1]) : 0;
      if (Math.abs(dy) > 12 && prev < 1 && next < 1) jumps++;
      lastDir = dir; lastMoveT = tr[i][0];
    }
    return { frames: tr.length, moves, path: Math.round(path), maxStep: Math.round(maxStep), reversals, jumps, errs };
  };
  const safe = (p) => p.catch((e) => ({ frames: 0, moves: 0, path: 0, maxStep: 0, reversals: -1, jumps: -1, errs: ["исключение: " + String(e.message || e).split("\n")[0]] }));
  const [a, b, c] = await Promise.all([
    safe(trace("spg-b0-2", ["ok", "bad", "ok"], false)),
    safe(trace("anticipation", ["ok", "bad", "ok", "ok"], false)),
    safe(trace("spg-b6-1", ["bad", "bad", "bad", "bad"], true)),
  ]);
  for (const [name, r] of [["хостес, обычный темп", a], ["антиципация, обычный темп", b], ["хостес, торопят нажатиями", c]]) {
    ok(`MO: ${name} — лента едет (${r.moves} кадров движения, ${r.path} px), без разворотов и прыжков`, r.moves > 20 && r.reversals === 0 && r.jumps === 0 && !r.errs.length, JSON.stringify(r));
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
const badN = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - badN} из ${results.length} · сценариев: ${DLG.length} · ${Math.round((Date.now() - t0) / 1000)} с`);
process.exit(badN ? 1 : 0);
