// v225 (Доп. 551): вторая часть разбора «что улучшить». Владелец (28.11): «Техника 2, визуал 5 пока пропускаем,
// остальное делаем». Общий вход для функций Supabase, опрос чата реже, когда тихо, в базе — пути к файлам (этап 76).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fnFetchUrl, fnUrl, fnHeaders, FN_WAIT, sbIn, sbOut, SUPABASE_KEY } from "../lib/supabase.js";
import { pollGap, listGap, POLL_HOT_MS, POLL_OPEN_MS, POLL_IDLE_MS, LIST_POLL_MS, LIST_IDLE_MS, IDLE_AFTER_MS } from "../lib/chat.js";
import { menuPhotoUrls } from "../lib/photo-ahead.js";
import { sectionPos, SECTION_BOX } from "../lib/intro-video.js";
import { INTRO_VIDEOS } from "../data/intro-videos.js";
import { TABLE_CSS } from "../ui/table-css.js";

const rd = (f) => readFileSync(f, "utf8");
const SB = "https://gvxhgdynjuaisswplroh.supabase.co";
const SITE = "https://service-academy-16te.vercel.app/sb";
const P = "/storage/v1/object/public/";
const res = (status, h = {}) => ({ ok: status < 400, status, headers: { get: (k) => h[k.toLowerCase()] || null } });

describe("v225 · версия и журнал", () => {
  it("сборка v225, Дополнение 551 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(225);
    const c = rd("CHANGES.md"), part = c.slice(c.indexOf("# Дополнение 551"));
    expect(part).toMatch(/^# Дополнение 551 — .*\(v225\)/);
    for (const w of ["остальное делаем", "fnFetch", "lib/chat.js", "supabase-stage76-storage-paths.sql", "test76.sh", "vercel.json"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v225 · общий вход для функций (lib/supabase.js)", () => {
  const fake = (plan) => { const calls = []; return { calls, f: (u, o) => { calls.push(u); const x = plan(u, calls.length, o); return x instanceof Error ? Promise.reject(x) : x instanceof Promise ? x : Promise.resolve(x); } }; };
  it("через сайт ответил — один запрос; ответ функции с ошибкой — как есть", async () => {
    const { f, calls } = fake(() => res(500));
    const r = await fnFetchUrl(SITE + "/functions/v1/ai-chat", { method: "POST" }, { fetchFn: f, site: SITE, direct: SB });
    expect([r.status, calls]).toEqual([500, [SITE + "/functions/v1/ai-chat"]]);
  });
  it("через сайт нет связи — тот же запрос напрямую; Vercel не пустил (x-vercel-mitigated) — тоже", async () => {
    const a = fake((u) => (u.startsWith(SITE) ? new TypeError("net") : res(200)));
    expect((await fnFetchUrl(SITE + "/functions/v1/stt", { method: "POST", body: "{}" }, { fetchFn: a.f, site: SITE, direct: SB })).status).toBe(200);
    expect(a.calls).toEqual([SITE + "/functions/v1/stt", SB + "/functions/v1/stt"]);
    const b = fake((u) => (u.startsWith(SITE) ? res(403, { "x-vercel-mitigated": "deny" }) : res(200)));
    expect((await fnFetchUrl(SITE + "/functions/v1/ai-chat?x=1", {}, { fetchFn: b.f, site: SITE, direct: SB })).status).toBe(200);
    expect(b.calls).toEqual([SITE + "/functions/v1/ai-chat?x=1", SB + "/functions/v1/ai-chat?x=1"]);
  });
  it("ошибка Vercel после отправки (x-vercel-error, 504) — второй раз не зовём: запрос мог дойти", async () => {
    const { f, calls } = fake(() => res(504, { "x-vercel-error": "FUNCTION_INVOCATION_TIMEOUT" }));
    expect((await fnFetchUrl(SITE + "/functions/v1/ai-chat", {}, { fetchFn: f, site: SITE, direct: SB })).status).toBe(504);
    expect(calls.length).toBe(1);
  });
  it("заголовков нет дольше срока — ошибка TimeoutError, напрямую не повторяем; срок — 2 минуты", async () => {
    const { f, calls } = fake(() => new Promise(() => {}));
    await expect(fnFetchUrl(SITE + "/functions/v1/ai-chat", {}, { fetchFn: f, site: SITE, direct: SB, wait: 30 })).rejects.toMatchObject({ name: "TimeoutError" });
    expect(calls.length).toBe(1);
    expect(FN_WAIT).toBe(120000);
  });
  it("напрямую или чужой адрес — один запрос без запасного пути", async () => {
    const { f, calls } = fake(() => new TypeError("net"));
    await expect(fnFetchUrl(SB + "/functions/v1/ai-chat", {}, { fetchFn: f, site: SB, direct: SB })).rejects.toThrow("net");
    await expect(fnFetchUrl("https://other.example/functions/v1/x", {}, { fetchFn: f, site: SITE, direct: SB })).rejects.toThrow("net");
    expect(calls).toEqual([SB + "/functions/v1/ai-chat", "https://other.example/functions/v1/x"]);
  });
  it("тело ответа не трогаем (поток «Живого гостя»); адрес и ключ — fnUrl, fnHeaders", async () => {
    const body = { stream: true };
    const { f } = fake(() => ({ ok: true, status: 200, headers: { get: () => null }, body }));
    expect((await fnFetchUrl(SITE + "/functions/v1/ai-chat", {}, { fetchFn: f, site: SITE, direct: SB })).body).toBe(body);
    expect(fnUrl("stt")).toBe(SB + "/functions/v1/stt");   // в проверках адреса страницы нет — напрямую
    expect(fnHeaders({ "Content-Type": "application/json" })).toEqual({ apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" });
  });
  it("в приложении не осталось ручных запросов к функциям: только через общий вход", () => {
    const files = [...readdirSync("lib").map((f) => "lib/" + f), ...readdirSync("ui").map((f) => "ui/" + f), "App.jsx"].filter((f) => /\.(js|jsx)$/.test(f) && f !== "lib/supabase.js");
    const raw = files.filter((f) => /fetch\(\s*(`\$\{SUPABASE_URL\}|SUPABASE_URL \+)\s*["`]?\/functions\/v1\//.test(rd(f)));
    expect(raw).toEqual([]);
    const sttRaw = files.filter((f) => /sttUrl=\{(`\$\{SUPABASE_URL\}|SUPABASE_URL)/.test(rd(f)));
    expect(sttRaw).toEqual([]);
    for (const [f, s] of [["lib/chat-ai.js", 'fnFetch("ai-chat", {'], ["lib/voice-note.js", 'fnFetch("voice-upload", {'], ["lib/radio-voice.js", 'fnFetch("radio-tts", {'],
      ["ui/wine-editor.jsx", 'fnFetch("photo-upload", {'], ["ui/cocktail-editor.jsx", 'fnFetch("photo-upload", {'], ["ui/hr-eval.jsx", 'fnFetch("ai-hr", {'],
      ["lib/voice.js", "await fnFetchUrl(sttUrl, {"], ["lib/talk.js", "withTimeout(fnFetchUrl(url,"], ["lib/chat-api.js", 'url: fnUrl("stt")'], ["ui/talk.jsx", 'const TTS_URL = () => fnUrl("radio-tts");']]) {
      expect(rd(f), f).toContain(s);
    }
    expect(rd("ui/menu-trainer.jsx").match(/fnFetch\("photo-upload", \{/g).length).toBe(3);
    expect(rd("lib/api-fetch.js")).toContain("fetchFn: (u, o) => (/\\/functions\\/v1\\//.test(String(u)) ? fnFetchUrl(u, o) : fetch(u, o))");
    expect(rd("ui/menu-trainer.jsx")).toContain("fnFetchUrl(u, o, { wait: 125000 })");
  });
});

describe("v225 · опрос чата реже, когда тихо (lib/chat.js)", () => {
  it("после своего — 1,5 с, живо — 4 с, минуту тихо — 10 с; список — 10 с, минуту без перемен — 20 с", () => {
    const now = 1e9;
    expect(pollGap(now, now + 1000, now)).toBe(POLL_HOT_MS);
    expect(pollGap(now, 0, now - 5000)).toBe(POLL_OPEN_MS);
    expect(pollGap(now, 0, now - IDLE_AFTER_MS)).toBe(POLL_IDLE_MS);
    expect(pollGap(now, now + 1, now - 10 * IDLE_AFTER_MS)).toBe(POLL_HOT_MS);
    expect([POLL_HOT_MS, POLL_OPEN_MS, POLL_IDLE_MS, IDLE_AFTER_MS]).toEqual([1500, 4000, 10000, 60000]);
    expect([listGap(now, now - 1000), listGap(now, now - IDLE_AFTER_MS), LIST_POLL_MS, LIST_IDLE_MS]).toEqual([10000, 20000, 10000, 20000]);
  });
  it("переписка и список чатов — по этим срокам; пришло новое или своё — снова часто (ui/chat.jsx)", () => {
    const c = rd("ui/chat.jsx");
    expect(c).toContain("const gap = pollGap(Date.now(), hotUntil.current, lastLive.current);");
    expect(c).toContain("const heat = () => { hotUntil.current = Date.now() + 20000; lastLive.current = Date.now(); };");
    expect(c).toContain("if (!first && Array.isArray(r.msgs) && r.msgs.length) lastLive.current = Date.now();");
    expect(c).toContain("if (now - last >= listGap(now, listChanged.current)) { last = now; load(); }");
    expect(c).not.toContain("setInterval(() => { if (!hidden()) load(); }, 10000);");
  });
});

describe("v225 · в базе — путь к файлу", () => {
  it("из базы: путь — до адреса (через сайт или напрямую); старый полный адрес — через сайт", () => {
    const got = sbIn({ a: P + "menu-photos/a.jpg", b: SB + P + "menu-photos/b.jpg", c: "текст " + P + "x.jpg", v: { chef: { url: P + "menu-voice/v.webm" } } }, SITE, SB);
    expect(got).toEqual({ a: SITE + P + "menu-photos/a.jpg", b: SITE + P + "menu-photos/b.jpg", c: "текст " + P + "x.jpg", v: { chef: { url: SITE + P + "menu-voice/v.webm" } } });
    expect(sbIn([P + "a.jpg"], SB, SB)).toEqual([SB + P + "a.jpg"]);   // напрямую: путь — до адреса Supabase
    expect(sbIn({ a: "/menu/x.jpg", b: "data:image/png;base64,AA" }, SITE, SB)).toEqual({ a: "/menu/x.jpg", b: "data:image/png;base64,AA" });
  });
  it("в базу: из любого полного адреса хранилища — путь; прочее как есть", () => {
    const j = JSON.stringify({ a: SITE + P + "a.jpg", b: SB + P + "b.jpg", c: P + "c.jpg", d: "https://example.com" + P + "d.jpg", e: "/menu/x.jpg" });
    expect(JSON.parse(sbOut(j, SITE, SB))).toEqual({ a: P + "a.jpg", b: P + "b.jpg", c: P + "c.jpg", d: "https://example.com" + P + "d.jpg", e: "/menu/x.jpg" });
  });
  it("фото меню заранее — и по пути из базы", () => {
    expect(menuPhotoUrls({ R: [{ img: P + "menu-photos/a.jpg" }, { img: "/assets/x.jpg" }] }, {}, "R")).toEqual([SB + P + "menu-photos/a.jpg"]);
  });
  it("сайт отдаёт пути хранилища сам: правило и кэш на сутки (vercel.json)", () => {
    const v = JSON.parse(rd("vercel.json"));
    expect(v.rewrites).toContainEqual({ source: "/storage/v1/object/public/:path*", destination: SB + "/storage/v1/object/public/:path*" });
    const h = v.headers.find((x) => x.source === "/storage/v1/object/public/(.*)");
    expect(h.headers).toEqual([{ key: "Cache-Control", value: "public, max-age=86400" }]);
    expect(v.headers.findIndex((x) => x.source === "/storage/v1/object/public/(.*)")).toBeGreaterThan(v.headers.findIndex((x) => x.source === "/(.*)"));
  });
  it("этап 76: проверка этапа 38, замена только проверки ссылки, перевод меню своего проекта, признак", () => {
    const s = rd("supabase/supabase-stage76-storage-paths.sql");
    expect(s).toContain("raise exception 'Сначала этап 38 (supabase-stage38-chat.sql): нужен чат команды';");
    expect(s).toContain(`old_re constant text := $q$'^https://[^\\s"<>]+$'$q$;`);
    expect(s).toContain(`new_re constant text := $q$'^(https://[^\\s"<>]+|/storage/v1/object/public/[^\\s"<>]+)$'$q$;`);
    expect(s).toContain("p.proname in ('_sa_chat_item', 'chat_stop_note', 'chat_stop_set')");
    expect(s).toContain("if to_regclass('public.restaurant_menu') is not null then");
    // только свой проект: путь к файлу чужого проекта Supabase вёл бы в наше хранилище, где такого файла нет
    expect(s).toContain("regexp_replace(dishes::text, 'https://gvxhgdynjuaisswplroh\\.supabase\\.co(/storage/v1/object/public/)', '\\1', 'g')::jsonb");
    expect(s).not.toContain("[a-z0-9]+\\.supabase");
    expect(s).toContain("create or replace function _sa_storage_path()");
    // этапы 38 и 46 в самих файлах — с той же проверкой: повторный запуск их не вернёт старую
    const NEW = `~ '^(https://[^\\s"<>]+|/storage/v1/object/public/[^\\s"<>]+)$'`, OLD = `~ '^https://[^\\s"<>]+$'`;
    const s38 = rd("supabase/supabase-stage38-chat.sql"), s46 = rd("supabase/supabase-stage46-bar-share.sql");
    expect(s38.split(NEW).length - 1).toBe(3);
    expect(s46.split(NEW).length - 1).toBe(1);
    expect(s38).not.toContain(OLD);
    expect(s46).not.toContain(OLD);
    expect(statSync("tools/claude/sql/test76.sh").size).toBeGreaterThan(3000);
    const R = rd("supabase/README.md");
    expect(R).toContain("| 85 | `supabase-stage76-storage-paths.sql` |");
    expect(R).toContain("**Этап 76** (`supabase-stage76-storage-paths.sql`, v225)");
  });
});

describe("v225 · обложка раздела с кадром ролика — выше, лицо целиком", () => {
  // владелец (28.11) выбрал из трёх вариантов средний: «Середина»
  const pct = (pos) => parseFloat(String(pos).split(" ")[1]) / 100;
  const at = (frac, w, pos) => { const hs = w * 16 / 9; return frac * hs - pct(pos) * (hs - SECTION_BOX.h); };
  it("окно 250 px, глаза на 102 px; у сезонного — 50% 23%, как в выбранном варианте", () => {
    expect(SECTION_BOX).toEqual({ w: 360, h: 250, eyes: 102 });
    expect(sectionPos(INTRO_VIDEOS["s0-1"])).toBe("50% 23%");
    expect(sectionPos(null)).toBe("50% 20%");
  });
  it("у всех ролей: глаза на 102 ± 4 px, подбородок над строкой «Урок · шаги» (242 px), фото без просвета сверху", () => {
    for (const [id, v] of Object.entries(INTRO_VIDEOS)) {
      const pos = sectionPos(v);
      expect(Math.abs(at(v.face.eyes, 360, pos) - 102), id).toBeLessThan(4);
      expect(at(v.face.chin, 360, pos), id).toBeLessThan(242 - 8);
      expect(pct(pos), id).toBeGreaterThanOrEqual(0);
      // на узком телефоне (320) подбородок тоже над строкой
      expect(at(v.face.chin, 290, pos), id).toBeLessThan(242 - 30);
    }
  });
  it("CSS: только у кадра ролика — 250 px, шапка с 226 px (с печатью — 208), затемнение ниже лица; свои фото — 178 px", () => {
    const css = TABLE_CSS;
    expect(css).toContain('.tbm-menu.covered[data-mod-cover="video"] .tbm-cover{height:250px}');
    expect(css).toContain('.tbm-menu.covered[data-mod-cover="video"] .tbm-head{padding-top:226px}');
    expect(css).toContain('.tbm-menu.covered.sealed[data-mod-cover="video"] .tbm-head{padding-top:208px}');
    expect(css).toContain('.tbm-menu.covered[data-mod-cover="video"] .tbm-cover::after{background:linear-gradient(180deg,rgba(22,17,9,0) 0%,rgba(22,17,9,.05) 60%,rgba(22,17,9,.75) 90%,rgba(22,17,9,.9) 100%)}');
    expect(css).toContain('html.sa-light .tbm-menu.covered[data-mod-cover="video"] .tbm-cover::after{background:linear-gradient(180deg,rgba(248,241,226,0) 0%,rgba(248,241,226,.05) 60%,rgba(248,241,226,.75) 90%,rgba(248,241,226,.9) 100%)}');
    expect(css).toContain(".tbm-cover{position:absolute;left:0;right:0;top:0;height:178px;");
    expect(css).toContain(".tbm-menu.covered .tbm-head{position:relative;padding-top:84px}");
    expect(css).not.toMatch(/object-position:50% 23%/);   // положение — из sectionPos, а не жёстко в CSS
  });
});
