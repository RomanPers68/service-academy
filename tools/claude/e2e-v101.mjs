// e2e v101 (Доп. 414): главная «Линза» — общий элемент на весь экран. Раскладка прежняя: всё круглое (медальоны дня,
// инструменты, SOS, треки, «Начать» в приглашении) — одно матовое золотистое стекло с золотым ободком и тонким кольцом,
// как кнопка AI; карточки — тем же стеклом с той же кромкой. Разделы:
//   LENS   — сотрудник, 393 px, тёмная тема: класс на корне главной, медальоны — стекло (эмаль прозрачна), инструменты —
//            стекло внутри и кольцо по краю кружка (inset 0, внешней тени нет), каждый кружок целиком в ряду (владелец:
//            «линзы выглядят не ровными, как будто обрезаны» — кольцо снаружи срезалось сверху и снизу), SOS — красная
//            линза с кольцом, треки — стекло с тонким кольцом, карточки — золотая кромка, «Начать» — линза;
//   TOOLS  — руководитель (пять инструментов и SOS) на 393, 375, 360 и 320 px: все кружки целиком в ряду и в капсуле;
//   LIGHT  — «Для чтения»: стекло и кромка — тёмным золотом;
//   NOW    — sa_home_look = "now": прежний вид — без класса, у кружков прежний цвет инструмента;
//   OWNER  — владелец: «Пульс недели» — той же кромкой;   WIDE — 1280 × 800 в две колонки: «Линза» и там;
//   FIT    — главная целиком на экране (lib/home-fit.js). Владелец (iPhone 16 Pro Max): «сжать немного элементы и
//            закрепить экран… чтобы было видно девиз академии… чтобы учитывались открытые уроки, тогда уже может
//            работать скрол». 440 × 795: логотип и отступы меньше, девиз над нижним меню, страница не листается;
//            карточка трека и список треков — листается, девиз доезжает до места над меню, размеры не прыгают; после
//            «Справочника» главная сразу в том же размере; 430 × 932 — места хватает, размеры прежние; 375 × 667 — не
//            влезает и так: вид и прокрутка прежние; «Для чтения» и «как сейчас» — тоже; лёжа и в две колонки — без этого;
//            вырез снизу 34 px (как у iPhone, через Emulation.setSafeAreaInsetsOverride) — то же;
//   GUARD  — замер скачет сам по себе (подмена getBoundingClientRect у девиза): подгонка не зацикливается, главная не
//            падает — первая сборка на iPhone падала с React #185 (снимок владельца из демо).
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v101.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5301, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v101";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".webp": "image/webp", ".css": "text/css" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise((r) => server.listen(PORT, r));

const R0 = "Два моря, Океан";
const ANNA = { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const MARIA = { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false };
const OWNER = { id: "u-own", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true };
const NOW = new Date("2026-10-28T23:00:00Z");   // 29.10, 11:00 по Камчатке
const TODAY = "2026-10-29", YDAY = "2026-10-28";
const DONE = { "s0-1": true, "s0-2": true, "s0-3": true };
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };

async function open({ who = ANNA, light = false, w = 393, h = 852, look = null, scores = [], safe = 0, init = null } = {}) {
  const uk = "_" + who.name + "_" + (who.surname || "");
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 900, hasTouch: w < 900, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const mock = {
        whoami: { ok: true, employee: who }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: Object.keys(DONE), stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: scores }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] },
        schedule_load: { ok: false, error: "auth" }, menu_get: [],
      };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_quest_open: "1",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(who), ["sa_last_role" + uk]: JSON.stringify("seasonal"), ["sa_completed" + uk]: JSON.stringify(DONE), ["sa_goal" + uk]: "2",
    ["sa_activity" + uk]: JSON.stringify({ [YDAY]: { st: 2, l: 2 } }), ["sa_streak" + uk]: JSON.stringify({ count: 3, best: 5, last: YDAY, days: [YDAY] }),
    sa_today_shift: JSON.stringify({ date: TODAY, label: "День · 12:00–20:00" }), ...(look ? { sa_home_look: look } : {}) };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } }, seed);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  // вырез снизу как у iPhone (env(safe-area-inset-bottom)): меню выше на 34 px
  if (safe) { const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: safe, left: 0, right: 0 } }); }
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(2000);
  return { ctx, page, errors };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });

// всё, что важно для «Линзы», одним замером
const probe = (p) => p.evaluate(() => {
  const cs = (e, pe) => getComputedStyle(e, pe || null);
  const root = document.querySelector("[data-home-look]");
  const row = document.querySelector("[data-tools-row]"), cap = document.querySelector("[data-tools-capsule]");
  const rr = row ? row.getBoundingClientRect() : null, cr = cap ? cap.getBoundingClientRect() : null;
  const discs = [...document.querySelectorAll("[data-tool-disc]")].map((d) => {
    const r = d.getBoundingClientRect(), b = cs(d, "::before"), a = cs(d, "::after");
    return { inRow: !!rr && r.top >= rr.top - 0.5 && r.bottom <= rr.bottom + 0.5 && r.left >= rr.left - 0.5 && r.right <= rr.right + 0.5,
      w: Math.round(r.width), h: Math.round(r.height), bg: cs(d).backgroundColor, before: b.content, beforeBg: b.backgroundColor, beforeInset: b.top,
      after: a.content, afterInset: a.top, afterBorder: a.borderTopWidth + " " + a.borderTopColor, afterShadow: a.boxShadow };
  });
  const sos = document.querySelector("[data-sos-disc]"), sr = sos ? sos.getBoundingClientRect() : null;
  const medal = document.querySelector(".de-medal"), enamel = medal ? medal.querySelector("svg > circle:not(.de-arc):not([data-medal-glow])") : null;
  const orb = document.querySelector("[data-track-chip]:not([data-track-locked]) [data-orb-glass]");
  const ring = document.querySelector("[data-track-chip]:not([data-track-locked]) svg circle");
  const tile = document.querySelector("[data-tile]"), pulse = document.querySelector("[data-pulse]"), lens = document.querySelector("[data-now-lens]");
  return {
    cls: root ? root.className : "", look: root ? root.getAttribute("data-home-look") : null, discs,
    capIn: !!cr && discs.length > 0 && [...document.querySelectorAll("[data-tool-disc]")].every((d) => { const r = d.getBoundingClientRect(); return r.left >= cr.left && r.right <= cr.right; }),
    sosShadow: sos ? cs(sos).boxShadow : "", sosRing: sos ? cs(sos, "::after").borderTopColor : "", sosIn: !!(sr && cr && sr.right <= cr.right && sr.left >= cr.left),
    medalBg: medal ? cs(medal).backgroundColor : "", medalRing: medal ? cs(medal, "::after").borderTopColor : "", enamelFill: enamel ? cs(enamel).fill : "",
    orbBg: orb ? cs(orb).backgroundColor : "", ringW: ring ? cs(ring).strokeWidth : "",
    tileEdge: tile ? cs(tile).borderTopColor : "", pulseEdge: pulse ? cs(pulse).borderTopColor : null, lens: lens ? cs(lens).backgroundColor : null,
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});
const allIn = (pr) => pr.discs.length > 0 && pr.discs.every((d) => d.inRow);

if (want("LENS")) {
  const o = await open();
  const pr = await probe(o.page);
  ok("LENS: по умолчанию — «Линза»: класс на корне главной", pr.look === "lens" && /\bsa-look-lens\b/.test(pr.cls), pr.cls);
  ok("LENS: медальоны — стекло, эмаль прозрачна, кольцо вокруг", pr.medalBg === "rgba(200, 169, 110, 0.12)" && /rgba\(0, 0, 0, 0\)|none|transparent/.test(pr.enamelFill) && pr.medalRing === "rgba(214, 178, 102, 0.44)", pr.medalBg + " · " + pr.enamelFill + " · " + pr.medalRing);
  ok("LENS: инструменты — стекло внутри кружка (::before на 2,5 px), кольцо по краю (::after, inset 0), без внешней тени",
    pr.discs.length === 4 && pr.discs.every((d) => d.bg === "rgba(0, 0, 0, 0)" && d.beforeBg === "rgba(200, 169, 110, 0.12)" && d.beforeInset === "2.5px" && d.afterInset === "0px" && /^1px rgba\(214, 178, 102, 0\.44\)$/.test(d.afterBorder) && d.afterShadow === "none"),
    JSON.stringify(pr.discs[0]));
  ok("LENS: каждый кружок целиком в ряду инструментов — кольцо не срезано", allIn(pr), pr.discs.map((d) => d.inRow).join(","));
  ok("LENS: SOS — красная линза с кольцом, в капсуле", /rgba\(234, 140, 140, 0\.62\)/.test(pr.sosShadow) && pr.sosRing === "rgba(234, 140, 140, 0.42)" && pr.sosIn, pr.sosShadow.slice(0, 60));
  ok("LENS: треки — стекло, кольцо тонкое (1 px)", pr.orbBg === "rgba(200, 169, 110, 0.12)" && pr.ringW === "1px", pr.orbBg + " · " + pr.ringW);
  ok("LENS: карточки — золотая кромка; «Начать» в приглашении — та же линза", pr.tileEdge === "rgba(214, 178, 102, 0.3)" && pr.lens === "rgba(200, 169, 110, 0.12)", pr.tileEdge + " · " + pr.lens);
  ok("LENS: без прокрутки вбок и без ошибок", !pr.hscroll && !o.errors.length, o.errors.join(" | "));
  await shot(o.page, "lens-393");
  await o.ctx.close();
}

if (want("TOOLS")) {
  for (const w of [393, 375, 360, 320]) {
    const o = await open({ who: MARIA, w });
    const pr = await probe(o.page);
    ok(`TOOLS ${w}: пять инструментов и SOS — все кружки целиком в ряду и в капсуле`, pr.discs.length === 5 && allIn(pr) && pr.capIn && pr.sosIn, pr.discs.map((d) => d.w + ":" + (d.inRow ? "ok" : "срез")).join(","));
    ok(`TOOLS ${w}: без прокрутки вбок и без ошибок`, !pr.hscroll && !o.errors.length, o.errors.join(" | "));
    if (w === 393 || w === 320) await shot(o.page, "tools-" + w);
    await o.ctx.close();
  }
}

if (want("LIGHT")) {
  for (const w of [393, 320]) {
    const o = await open({ who: MARIA, light: true, w });
    const pr = await probe(o.page);
    ok(`LIGHT ${w}: стекло и кромка — тёмным золотом`, pr.medalBg === "rgba(139, 106, 48, 0.09)" && pr.discs.every((d) => d.beforeBg === "rgba(139, 106, 48, 0.09)") && pr.tileEdge === "rgba(139, 106, 48, 0.3)", pr.medalBg + " · " + pr.tileEdge);
    ok(`LIGHT ${w}: кружки целиком в ряду, SOS — тёмно-красной линзой`, allIn(pr) && /rgba\(163, 58, 42, 0\.62\)/.test(pr.sosShadow), pr.sosShadow.slice(0, 60));
    ok(`LIGHT ${w}: без прокрутки вбок и без ошибок`, !pr.hscroll && !o.errors.length, o.errors.join(" | "));
    await shot(o.page, "light-" + w);
    await o.ctx.close();
  }
}

if (want("NOW")) {
  const o = await open({ look: "now" });
  const pr = await probe(o.page);
  ok("NOW: «как сейчас» — без класса вида", pr.look === "now" && !/sa-look/.test(pr.cls), pr.cls);
  ok("NOW: у кружков прежний цвет инструмента, без стекла и кольца", pr.discs.length === 4 && pr.discs.every((d) => d.bg !== "rgba(0, 0, 0, 0)" && d.before === "none" && d.after === "none"), JSON.stringify(pr.discs[0]));
  ok("NOW: медальоны — эмаль", pr.medalBg === "rgba(0, 0, 0, 0)" && !/rgba\(0, 0, 0, 0\)|none/.test(pr.enamelFill), pr.medalBg + " · " + pr.enamelFill);
  ok("NOW: без ошибок", !o.errors.length, o.errors.join(" | "));
  await shot(o.page, "now-393");
  await o.ctx.close();
}

if (want("OWNER")) {
  const wk = new Date(NOW.getTime() - 3600e3).toISOString();
  const o = await open({ who: OWNER, scores: [{ name: "Анна", surname: "Смирнова", score: 8, updated_at: wk }, { name: "Пётр", surname: "Орлов", score: 6, updated_at: wk }] });
  const pr = await probe(o.page);
  ok("OWNER: «Линза»; «Пульс недели» — той же кромкой", /\bsa-look-lens\b/.test(pr.cls) && pr.pulseEdge === "rgba(214, 178, 102, 0.3)", String(pr.pulseEdge));
  ok("OWNER: кружки целиком в ряду, без ошибок", allIn(pr) && !o.errors.length, o.errors.join(" | "));
  await shot(o.page, "owner");
  await o.ctx.close();
}

if (want("WIDE")) {
  const o = await open({ who: MARIA, w: 1280, h: 800 });
  const pr = await probe(o.page);
  ok("WIDE: в две колонки — тоже «Линза», кружки целиком", /\bsa-look-lens\b/.test(pr.cls) && allIn(pr) && !pr.hscroll, pr.cls);
  ok("WIDE: без ошибок", !o.errors.length, o.errors.join(" | "));
  await shot(o.page, "wide");
  await o.ctx.close();
}

// главная целиком на экране: размеры, девиз над меню, прокрутка
const fitProbe = (p) => p.evaluate(() => {
  const root = document.querySelector("[data-home-look]"), q = document.querySelector("[data-tracks-quote]"), tb = document.getElementById("sa-tabbar"), sc = document.getElementById("root");
  const logo = root ? root.querySelector("img") : null, lr = logo ? logo.getBoundingClientRect() : null;
  return {
    k: root ? Number(root.getAttribute("data-home-fit") || 0) : -1, tail: root ? root.getAttribute("data-home-tail") : "нет главной",
    logoW: lr ? Math.round(lr.width) : 0, logoH: lr ? Math.round(lr.height) : 0,
    gap: q && tb ? Math.round((tb.getBoundingClientRect().top - q.getBoundingClientRect().bottom) * 10) / 10 : null,
    scroll: sc ? sc.scrollHeight - sc.clientHeight : null,
    panel: !!document.querySelector("[data-track-open]"), list: !!document.querySelector("[data-tracks-list]"),
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});
const scrollTo = (p, end) => p.evaluate((e) => { const sc = document.getElementById("root"); sc.scrollTop = e ? sc.scrollHeight : 0; }, end);
const fs = (f) => `k ${f.k} · под девизом ${f.tail === null ? "как было" : f.tail} · лого ${f.logoW}×${f.logoH} · зазор ${f.gap} · прокрутка ${f.scroll}`;

if (want("FIT")) {
  {
    const o = await open({ who: MARIA, w: 440, h: 795 });
    const f0 = await fitProbe(o.page);
    ok("FIT 440×795: логотип и отступы меньше (152×121 → не мельче 90×72)", f0.k > 0 && f0.k <= 1 && f0.logoH < 121 && f0.logoH >= 72 && f0.logoW >= 90, fs(f0));
    ok("FIT 440×795: девиз над нижним меню (зазор не меньше 7,5 px)", f0.gap !== null && f0.gap >= 7.5, fs(f0));
    ok("FIT 440×795: экран стоит — страница не листается", f0.scroll === 0, fs(f0));
    const pr = await probe(o.page);
    ok("FIT 440×795: инструменты целиком в ряду, без прокрутки вбок", allIn(pr) && pr.capIn && !f0.hscroll, pr.discs.map((d) => d.w).join(","));
    await shot(o.page, "fit-440x795");
    // карточка трека: листается, размеры те же, девиз доезжает до места над меню
    await o.page.locator("[data-track-chip]").first().click();
    await o.page.waitForTimeout(700);
    const f1 = await fitProbe(o.page);
    ok("FIT: карточка трека раскрыта — страница листается, размеры не прыгнули", f1.panel && f1.scroll > 0 && f1.k === f0.k && f1.logoH === f0.logoH, fs(f1));
    await shot(o.page, "fit-track-open");
    await scrollTo(o.page, true); await o.page.waitForTimeout(250);
    const f2 = await fitProbe(o.page);
    ok("FIT: карточка трека — прокрутка до конца: девиз над меню", f2.gap !== null && f2.gap >= 7.5, fs(f2));
    await scrollTo(o.page, false); await o.page.waitForTimeout(150);
    await o.page.locator("[data-track-chip]").first().click();
    await o.page.waitForTimeout(800);
    const f3 = await fitProbe(o.page);
    ok("FIT: карточку свернули — снова целиком и без прокрутки", !f3.panel && f3.scroll === 0 && f3.gap >= 7.5 && Math.abs(f3.k - f0.k) <= 0.05, fs(f3));
    // список треков «подробнее»
    await o.page.locator("[data-tracks-toggle]").click();
    await o.page.waitForTimeout(900);
    const f4 = await fitProbe(o.page);
    ok("FIT: список треков раскрыт — страница листается, размеры не прыгнули", f4.list && f4.scroll > 0 && f4.k === f3.k, fs(f4));
    await scrollTo(o.page, true); await o.page.waitForTimeout(250);
    const f5 = await fitProbe(o.page);
    ok("FIT: список — прокрутка до конца: девиз над меню", f5.gap !== null && f5.gap >= 7.5, fs(f5));
    await scrollTo(o.page, false); await o.page.waitForTimeout(150);
    await o.page.locator("[data-tracks-toggle]").click();
    await o.page.waitForTimeout(800);
    const f6 = await fitProbe(o.page);
    ok("FIT: список свернули — снова целиком и без прокрутки", !f6.list && f6.scroll === 0 && f6.gap >= 7.5, fs(f6));
    // в «Справочник» и обратно: главная сразу в том же размере
    await o.page.evaluate(() => window.__saNav("reference"));
    await o.page.waitForTimeout(900);
    await o.page.evaluate(() => window.__saNav("roleSelect"));
    await o.page.waitForTimeout(120);
    const f7 = await fitProbe(o.page);
    ok("FIT: после «Справочника» главная сразу в том же размере", f7.k > 0 && Math.abs(f7.k - f6.k) <= 0.05 && f7.scroll === 0, fs(f7));
    ok("FIT 440×795: без ошибок", !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
  {
    const o = await open({ who: MARIA, w: 430, h: 932 });
    const f = await fitProbe(o.page);
    ok("FIT 430×932: места хватает — размеры прежние (152×121), девиз над меню, не листается", f.k === 0 && f.logoW === 152 && f.logoH === 121 && f.gap >= 7.5 && f.scroll === 0, fs(f));
    await o.ctx.close();
  }
  {
    const o = await open({ who: ANNA, w: 375, h: 667 });
    const f = await fitProbe(o.page);
    ok("FIT 375×667: не влезает и так — вид прежний (152×121), прокрутка как была", f.k === 0 && f.tail === null && f.logoH === 121 && f.scroll > 0, fs(f));
    ok("FIT 375×667: без ошибок", !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
  {
    const o = await open({ who: MARIA, w: 440, h: 795, light: true });
    const f = await fitProbe(o.page);
    ok("FIT «Для чтения» 440×795: так же — девиз над меню, не листается", f.k > 0 && f.gap >= 7.5 && f.scroll === 0, fs(f));
    await shot(o.page, "fit-light");
    await o.ctx.close();
  }
  {
    const o = await open({ who: MARIA, w: 440, h: 795, look: "now" });
    const f = await fitProbe(o.page);
    ok("FIT «как сейчас» 440×795: подгонка та же", f.k > 0 && f.gap >= 7.5 && f.scroll === 0, fs(f));
    await o.ctx.close();
  }
  {
    const o = await open({ who: MARIA, w: 852, h: 393 });
    const f = await fitProbe(o.page);
    ok("FIT лёжа 852×393: без подгонки", f.k === 0 && f.tail === null, fs(f));
    await o.ctx.close();
  }
  {
    const o = await open({ who: MARIA, w: 1280, h: 800 });
    const f = await fitProbe(o.page);
    ok("FIT 1280×800 в две колонки: без подгонки", f.k === 0 && f.tail === null, fs(f));
    await o.ctx.close();
  }
  // iPhone владельца: вырез снизу 34 px — меню выше; первая сборка в браузере iPhone зацикливалась (React #185)
  for (const who of [ANNA, MARIA]) {
    const o = await open({ who, w: 440, h: 820, safe: 34 });
    const f = await fitProbe(o.page);
    const crash = await o.page.evaluate(() => document.body.innerText.includes("Что-то пошло не так"));
    ok(`FIT вырез 34 px, 440×820, ${who.name}: главная на месте, девиз над меню, не листается`, !crash && f.k >= 0 && f.gap >= 7.5 && f.scroll === 0, fs(f));
    ok(`FIT вырез 34 px, ${who.name}: без ошибок`, !crash && !o.errors.length, o.errors.join(" | ").slice(0, 300));
    if (who === MARIA) await shot(o.page, "fit-safe-440x820");
    await o.ctx.close();
  }
}

// предохранитель: замер, который сам по себе скачет (девиз то на месте, то на 80 px ниже) — подгонка не зацикливается,
// главная не падает (было: React #185 «Maximum update depth exceeded» на iPhone)
if (want("GUARD")) {
  const init = () => {
    const orig = Element.prototype.getBoundingClientRect;
    let n = 0;
    Element.prototype.getBoundingClientRect = function () {
      const r = orig.call(this);
      if (!this.hasAttribute || !this.hasAttribute("data-tracks-quote")) return r;
      const d = (n++ % 2) * 80;
      return { x: r.x, y: r.y + d, left: r.left, right: r.right, width: r.width, height: r.height, top: r.top + d, bottom: r.bottom + d, toJSON() { return this; } };
    };
  };
  const o = await open({ who: MARIA, w: 440, h: 795, init });
  await o.page.waitForTimeout(600);
  const crash = await o.page.evaluate(() => document.body.innerText.includes("Что-то пошло не так"));
  const f = await fitProbe(o.page);
  ok("GUARD: скачущий замер — главная на месте, без «Что-то пошло не так»", !crash && f.k >= 0, fs(f));
  ok("GUARD: без «Maximum update depth» и других ошибок", !o.errors.some((e) => /Maximum update depth|#185/.test(e)) && !o.errors.length, o.errors.join(" | ").slice(0, 300));
  // окно меньше — подгонка снова работает (предохранитель — только для размера, где сработал)
  await o.page.setViewportSize({ width: 440, height: 760 }); await o.page.waitForTimeout(500);
  const crash2 = await o.page.evaluate(() => document.body.innerText.includes("Что-то пошло не так"));
  ok("GUARD: после смены размера окна — тоже без сбоя", !crash2, "");
  await o.ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок пройдено`);
process.exit(bad ? 1 : 0);
