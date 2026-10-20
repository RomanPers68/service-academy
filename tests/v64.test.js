// v64 (Доп. 377): старт одним запросом — app_bootstrap (этап 27) и клиентская прослойка в api/supabase.js.
//
// Владелец: «Давай поправим все, вместе с серверными изменениями😉». Вид в браузере — tools/claude/e2e-v64.mjs.
// Здесь — поведение прослойки на заглушках fetch/localStorage: что уходит в сеть, что берётся из общего ответа,
// как откатывается, когда этапа 27 нет или часть не собралась.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { rpc, startBoot, bootActive, bootPart, bootParts, flushQueue, queueLength, BOOT_FNS, BOOT_TTL_MS, _resetBoot, SUPABASE_URL } from "../api/supabase.js";

const rd = (f) => readFileSync(f, "utf8");

// ── стенд: память телефона и сеть ────────────────────────────────────────────────────────────────────────
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
let calls = [];          // [{ fn, body }]
let answers = {};        // fn → ответ (объект) или функция(body) → объект
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.fetch = async (url, init) => {
  const fn = String(url).split("/rpc/")[1];
  const body = init && init.body ? JSON.parse(init.body) : {};
  calls.push({ fn, body });
  await sleep(2);
  const a = answers[fn];
  const res = typeof a === "function" ? a(body) : a;
  if (res === "http500") return { ok: false, status: 500, json: async () => ({ message: "boom" }) };
  return { ok: true, status: 200, json: async () => (res === undefined ? null : res) };
};
const PARTS = {
  whoami: { ok: true, employee: { id: "u1", name: "Анна", surname: "Новикова" } },
  my_state: { ok: true, v: 2, quiz: ["q1"], lessons: ["l1"], stars: {}, roles: [], last_role: "seasonal" },
  my_reset_at: { ok: true, reset_at: null },
  team_scores: { ok: false, error: "boot", message: "boom" },   // часть упала на сервере
  day_brief: null,                                              // часть без ответа
  // my_mentors — части нет вовсе (этап не применён)
};
const bootOk = () => ({ ok: true, v: 1, at: "2026-10-20T00:00:00Z", parts: PARTS });
const sent = (fn) => calls.filter((c) => c.fn === fn).length;

beforeEach(() => { store.clear(); calls = []; answers = { app_bootstrap: bootOk(), whoami: { ok: true, direct: true }, my_state: { ok: true, direct: true }, team_scores: { ok: true, direct: true }, day_brief: { ok: true, direct: true }, my_mentors: { ok: true, direct: true }, schedule_load: { ok: true, direct: true } }; _resetBoot(); });

describe("v64: старт одним запросом — клиент", () => {
  it("startBoot шлёт один app_bootstrap; whoami и my_state берутся из общего ответа без своих запросов", async () => {
    startBoot("tok");
    const who = await rpc("whoami", { p_token: "tok" });
    const st = await rpc("my_state", { p_token: "tok" });
    expect(who.employee.name).toBe("Анна");
    expect(st.last_role).toBe("seasonal");
    expect(sent("app_bootstrap")).toBe(1);
    expect(sent("whoami")).toBe(0);
    expect(sent("my_state")).toBe(0);
    expect(calls[0].body).toEqual({ p_token: "tok" });
  });

  it("каждая часть выдаётся один раз: повторный my_state — уже по сети (свежие данные после записи)", async () => {
    startBoot("tok");
    await rpc("my_state", { p_token: "tok" });
    const again = await rpc("my_state", { p_token: "tok" });
    expect(again.direct).toBe(true);
    expect(sent("my_state")).toBe(1);
  });

  it("часть упала (error: boot), без ответа (null) или её нет — функция зовётся напрямую, как раньше", async () => {
    startBoot("tok");
    const [ts, db, mm] = await Promise.all([
      rpc("team_scores", { p_token: "tok" }), rpc("day_brief", { p_token: "tok" }), rpc("my_mentors", { p_token: "tok" }),
    ]);
    expect(ts.direct).toBe(true); expect(db.direct).toBe(true); expect(mm.direct).toBe(true);
    expect(sent("team_scores")).toBe(1); expect(sent("day_brief")).toBe(1); expect(sent("my_mentors")).toBe(1);
    expect(sent("app_bootstrap")).toBe(1);
  });

  it("этапа 27 нет (PGRST202): всё по сети, отметка sa_boot_missing, сутки бутстрап не зовём", async () => {
    answers.app_bootstrap = { code: "PGRST202", message: "Could not find the function" };
    startBoot("tok");
    const who = await rpc("whoami", { p_token: "tok" });
    expect(who.direct).toBe(true);
    expect(sent("whoami")).toBe(1);
    expect(Number(store.get("sa_boot_missing"))).toBeGreaterThan(0);
    calls = []; _resetBoot();   // следующий заход в приложение
    expect(startBoot("tok")).toBe(null);
    expect(sent("app_bootstrap")).toBe(0);
    // через сутки — пробуем снова (запрос уходит на следующем тике — после очереди)
    expect(startBoot("tok", Date.now() + 86400000 + 1)).not.toBe(null);
    await sleep(5);
    expect(sent("app_bootstrap")).toBe(1);
  });

  it("сервер ответил ошибкой HTTP или мусором — откат на отдельные запросы, без исключений", async () => {
    answers.app_bootstrap = "http500";
    startBoot("tok");
    expect((await rpc("whoami", { p_token: "tok" })).direct).toBe(true);
    _resetBoot(); calls = [];
    answers.app_bootstrap = { ok: true, parts: [1, 2] };   // parts не объект
    startBoot("tok");
    expect((await rpc("my_state", { p_token: "tok" })).direct).toBe(true);
    expect(bootParts({ ok: true, parts: [1] })).toBe(null);
    expect(bootParts(null)).toBe(null);
    expect(bootPart({ a: { x: 1 } }, "a")).toEqual({ x: 1 });
    expect(bootPart({ a: { error: "boot" } }, "a")).toBe(undefined);
  });

  it("чужой токен, функция не из списка и срок в 30 с — мимо бутстрапа (прямой запрос)", async () => {
    startBoot("tok");
    expect(bootActive("whoami", { p_token: "other" })).toBe(false);
    expect(bootActive("schedule_load", { p_token: "tok" })).toBe(false);
    expect(bootActive("whoami", { p_token: "tok" })).toBe(true);
    expect(bootActive("whoami", { p_token: "tok" }, Date.now() + BOOT_TTL_MS + 1)).toBe(false);
    expect(bootActive("whoami", null)).toBe(false);
    const sl = await rpc("schedule_load", { p_token: "tok" });
    expect(sl.direct).toBe(true);
    expect(BOOT_FNS).toContain("day_brief");
    expect(BOOT_FNS).toContain("cms_list_lessons");
    expect(BOOT_FNS).not.toContain("schedule_load");
    expect(BOOT_FNS).not.toContain("mastery_list");        // их зовут «Команда» и «Путь мастера», не главная
    expect(BOOT_FNS).not.toContain("team_achievements");
  });

  it("офлайн-очередь уходит раньше бутстрапа: my_state в ответе уже знает про записанное", async () => {
    store.set("sa_sync_queue", JSON.stringify([{ fn: "save_progress", params: { p_token: "tok", p_lesson: "l9" }, ts: Date.now() }]));
    answers.save_progress = { ok: true };
    expect(queueLength()).toBe(1);
    const p = flushQueue();          // как при старте приложения: прогон очереди уже идёт
    startBoot("tok");
    await rpc("my_state", { p_token: "tok" });
    await p;
    expect(calls.map((c) => c.fn)).toEqual(["save_progress", "app_bootstrap"]);
    expect(queueLength()).toBe(0);
  });

  it("flushQueue: повторный вызов во время прогона возвращает тот же promise", async () => {
    store.set("sa_sync_queue", JSON.stringify([{ fn: "save_progress", params: {}, ts: Date.now() }]));
    answers.save_progress = { ok: true };
    const a = flushQueue(), b = flushQueue();
    expect(a).toBe(b);
    await a;
    expect(sent("save_progress")).toBe(1);
  });

  it("повторный startBoot с тем же токеном в первые секунды — тот же запрос (StrictMode, вход сразу после старта)", async () => {
    const a = startBoot("tok"), b = startBoot("tok");
    expect(a).toBe(b);
    await a;
    expect(sent("app_bootstrap")).toBe(1);
    expect(startBoot("tok", Date.now() + 3001)).not.toBe(a);   // позже — новый запрос (свежие данные)
    await sleep(5);
    expect(sent("app_bootstrap")).toBe(2);
    _resetBoot(); calls = [];
    startBoot("tok"); startBoot("other");   // другой токен — другой запрос
    await sleep(5);
    expect(sent("app_bootstrap")).toBe(2);
  });

  it("без токена бутстрапа нет", () => {
    expect(startBoot(null)).toBe(null);
    expect(startBoot("")).toBe(null);
    expect(sent("app_bootstrap")).toBe(0);
  });
});

describe("v64: приложение и этап 27", () => {
  it("App.jsx зовёт startBoot при старте (сразу после проверки токена) и после входа по коду", () => {
    const app = rd("App.jsx");
    expect(app).toMatch(/import \{[^}]*startBoot[^}]*\} from "\.\/api\/supabase"/);
    expect(app).toMatch(/if \(!token\) \{[^\n]*setScreen\("login"\); return; \}\n\s*startBoot\(token\);/);
    expect(app).toMatch(/startBoot\(token \|\| "demo"\);[^\n]*\n\s*setProfile\(prof\);\n\s*setScreen\("roleSelect"\);/);
  });

  it("этап 27: app_bootstrap(text) → jsonb, части по списку, только функции (text) → json/jsonb одной строкой, права anon", () => {
    const sql = rd("supabase/supabase-stage27-bootstrap.sql");
    expect(sql).toContain("create or replace function public.app_bootstrap(p_token text)");
    expect(sql).toContain("returns jsonb");
    // с правами того, кто зовёт: части — ровно то, что приложение получило бы само; новых путей к данным нет
    expect(sql).toContain("security invoker");
    expect(sql).not.toContain("security definer");
    for (const k of BOOT_FNS) expect(sql).toContain(`'${k}'`);
    expect(sql).toContain("array['whoami_txt','whoami']");   // whoami: переходник или сам whoami(text)
    expect(sql).toContain("not p.proretset");
    expect(sql).toContain("p.proargtypes[0] = 'text'::regtype");
    expect(sql).toContain("p.prorettype in ('json'::regtype, 'jsonb'::regtype)");
    expect(sql).toContain("exception when others then");
    expect(sql).toContain("'error', 'boot'");
    expect(sql).toContain("grant execute on function public.app_bootstrap(text) to anon, authenticated;");
    expect(sql).toContain("notify pgrst, 'reload schema';");
    expect(sql).toContain("has_table_privilege('anon'");
  });

  it("адрес сервера прежний, ключ по-прежнему не в тесте", () => {
    expect(SUPABASE_URL).toMatch(/^https:\/\/[a-z]+\.supabase\.co$/);
  });
});
