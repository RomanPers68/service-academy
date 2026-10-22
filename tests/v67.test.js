// v67 (Доп. 380): переход на Claude Haiku 5.5 и кэш подсказки Наставника.
// Владелец: «Поможешь перейти на haiku 5.5? И по поводу кэширования… Как это будет выглядеть?»
// У моделей Claude 5.x другие правила (документация Anthropic и OpenRouter): temperature только 1 (иначе ошибка 400),
// размышления включены сами и тратят тот же лимит max_tokens, новый токенизатор считает текст на ~30% длиннее.
// Функции ai-chat и ai-hr — на стенде (заглушки Deno и OpenRouter), вид «Проверки AI HR» — tools/claude/e2e-v66.mjs (STALE).
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { hrStatus, modelKey, latestModel } from "../lib/hr-quality.js";

const rd = (f) => readFileSync(f, "utf8");
const ENV = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE_KEY: "svc", OPENROUTER_API_KEY: "or-key", OPENROUTER_MODEL: "anthropic/claude-haiku-5.5" };
if (!globalThis.Deno) globalThis.Deno = { serve() {}, env: { get: (k) => ENV[k] } };
const hr = await import("../supabase/functions/ai-hr/index.ts");
const chat = await import("../supabase/functions/ai-chat/index.ts");

// ── стенд сети для ai-hr: тела запросов к OpenRouter целиком ──
let bodies = [], replies = [];
const send = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith("/rest/v1/rpc/whoami")) return send({ ok: true, employee: { name: "Ольга", restaurant: "Два моря, Океан", position: "manager" } });
  if (u.endsWith("/rest/v1/rpc/cms_list_lessons")) return send([]);
  if (u.includes("openrouter.ai/api/v1/chat/completions")) {
    const body = JSON.parse(init.body || "{}");
    bodies.push(body);
    const r = replies.length ? replies.shift() : "Здравствуйте!";
    if (r && typeof r === "object" && r.status) return send({ error: { message: "down" } }, r.status);
    return send({ model: body.model, choices: [{ message: { content: r } }] });
  }
  return send(null, 404);
};
const call = async (payload) => (await hr.handle(new Request("https://fn.test/ai-hr", { method: "POST", body: JSON.stringify({ token: "t", role: "waiter", candidate: { name: "Мария", expLabel: "До года", level: "junior" }, ...payload }) }))).json();
const comps = hr.ROLE_COMPS.waiter;
const scoreJson = (v) => JSON.stringify({ competencies: Object.fromEntries(comps.map((c) => [c, { score: v, why: "почему", quote: "цитата" }])), verdict: "Рекомендован.", strengths: [], growth: [], risks: [], ask: [] });
beforeEach(() => { bodies = []; replies = []; ENV.OPENROUTER_MODEL = "anthropic/claude-haiku-5.5"; delete ENV.OPENROUTER_FALLBACK_MODEL; });

describe("v67: какие модели — «новые» Claude", () => {
  const V = (m) => hr.claudeVer(m);
  it("версия из названия модели OpenRouter", () => {
    expect(V("anthropic/claude-haiku-5.5")).toEqual({ major: 5, minor: 5 });
    expect(V("anthropic/claude-haiku-5.5-20261007")).toEqual({ major: 5, minor: 5 });
    expect(V("anthropic/claude-haiku-4.5")).toEqual({ major: 4, minor: 5 });
    expect(V("anthropic/claude-3.5-haiku")).toEqual({ major: 3, minor: 5 });
    expect(V("anthropic/claude-opus-4-20250514")).toEqual({ major: 4, minor: 0 });   // дата — не «минорная версия»
    expect(V("~anthropic/claude-sonnet-latest")).toEqual({ major: 99, minor: 0 });
    expect(V("deepseek/deepseek-chat-v3-0324:free")).toBe(null);
  });
  it("новые — 4.7 и дальше (Haiku 5.5, Sonnet 5.5, Opus 4.7…); Haiku 4.5, Sonnet 4.6 и бесплатные — прежние", () => {
    for (const m of ["anthropic/claude-haiku-5.5", "anthropic/claude-sonnet-5.5", "anthropic/claude-sonnet-5", "anthropic/claude-opus-4.7", "~anthropic/claude-haiku-latest"]) expect(hr.isNewClaude(m)).toBe(true);
    for (const m of ["anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4.6", "anthropic/claude-3.5-haiku", "qwen/qwen3-235b-a22b:free", ""]) expect(hr.isNewClaude(m)).toBe(false);
  });
  it("параметры: Haiku 5.5 — без temperature, в живом разговоре размышления выключены, лимит ×1,35; Sonnet 5.5 — минимальные и запас; прежние — как было", () => {
    expect(hr.genOpts("anthropic/claude-haiku-5.5", 320, 0.7)).toEqual({ max_tokens: 432, reasoning: { enabled: false } });
    expect(hr.genOpts("anthropic/claude-sonnet-5.5", 520, 0.6)).toEqual({ max_tokens: 4702, reasoning: { effort: "low", exclude: true } });
    expect(hr.genOpts("anthropic/claude-haiku-4.5", 320, 0.7)).toEqual({ max_tokens: 320, temperature: 0.7 });
    expect(hr.genOpts("deepseek/deepseek-chat-v3-0324:free", 180, 0.8)).toEqual({ max_tokens: 180, temperature: 0.8 });
  });
  it("задачи с оценкой — с размышлениями: «low» и «medium», лимит с запасом под них; прежним моделям всё равно", () => {
    expect(hr.genOpts("anthropic/claude-haiku-5.5", 2000, 0.3, "medium")).toEqual({ max_tokens: 10700, reasoning: { effort: "medium", exclude: true } });
    expect(hr.genOpts("anthropic/claude-haiku-5.5", 520, 0.6, "low")).toEqual({ max_tokens: 4702, reasoning: { effort: "low", exclude: true } });
    expect(hr.genOpts("anthropic/claude-sonnet-5.5", 2000, 0.3, "medium")).toEqual({ max_tokens: 10700, reasoning: { effort: "medium", exclude: true } });
    expect(hr.genOpts("anthropic/claude-haiku-4.5", 2000, 0.3, "medium")).toEqual({ max_tokens: 2000, temperature: 0.3 });
  });
  it("в ai-chat — та же функция (файлы разворачиваются по отдельности)", () => {
    for (const m of ["anthropic/claude-haiku-5.5", "anthropic/claude-sonnet-5.5", "anthropic/claude-opus-4.7", "anthropic/claude-haiku-4.5", "meta-llama/llama-3.3-70b-instruct:free"]) {
      for (const [mt, t] of [[180, 0.8], [520, 0.6], [700, 0.2]]) for (const k of ["off", "low", "medium"]) expect(chat.genOpts(m, mt, t, k)).toEqual(hr.genOpts(m, mt, t, k));
      expect(chat.claudeVer(m)).toEqual(hr.claudeVer(m));
    }
  });
});

describe("v67: ai-hr на Haiku 5.5", () => {
  it("ход интервью: без temperature, размышления выключены, лимит 432; разговор начинается с реплики кандидата", async () => {
    replies = ["Здравствуйте, Мария!"];
    await call({ mode: "chat", messages: [], plan: [] });
    const b = bodies[0];
    expect(b.model).toBe("anthropic/claude-haiku-5.5");
    expect(b.temperature).toBeUndefined();
    expect(b.reasoning).toEqual({ enabled: false });
    expect(b.max_tokens).toBe(432);
    expect(b.messages[1]).toEqual({ role: "user", content: hr.OPENER });
    expect(b.messages[b.messages.length - 1].role).toBe("user");
  });
  it("вопрос интервьюера первым — перед ним вводная кандидата; голосом — лимит 297", async () => {
    replies = ["Понятно. Следующая ситуация…"];
    await call({ mode: "chat", voice: true, messages: [{ role: "assistant", content: "Q1" }, { role: "user", content: "Извинюсь" }], plan: [{ topic: 0 }] });
    expect(bodies[0].messages.slice(1).map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(bodies[0].max_tokens).toBe(297);
  });
  it("оценка: с размышлениями (medium), лимит 2700 ×… + запас = 10700, без temperature; запасная Haiku 4.5 — с прежними параметрами", async () => {
    ENV.OPENROUTER_FALLBACK_MODEL = "anthropic/claude-haiku-4.5";
    // два прогона идут параллельно: у каждого Haiku 5.5 дважды не ответила → запасная
    replies = [{ status: 500 }, { status: 500 }, { status: 500 }, { status: 500 }, scoreJson(80), scoreJson(80)];
    const d = await call({ mode: "assess", messages: [{ role: "assistant", content: "Q" }, { role: "user", content: "A" }], plan: [{ topic: 0 }] });
    expect(d.ok).toBe(true);
    const h55 = bodies.filter((b) => b.model === "anthropic/claude-haiku-5.5"), h45 = bodies.filter((b) => b.model === "anthropic/claude-haiku-4.5");
    expect(h55.length).toBeGreaterThan(0);
    expect(h55.every((b) => b.max_tokens === 10700 && b.temperature === undefined && b.reasoning.effort === "medium" && b.reasoning.exclude === true)).toBe(true);
    expect(h45.length).toBeGreaterThan(0);
    expect(h45.every((b) => b.max_tokens === 2000 && b.temperature === 0.3 && b.reasoning === undefined)).toBe(true);
  });
  it("Haiku 4.5 (сейчас у владельца) — запросы как в v66", async () => {
    ENV.OPENROUTER_MODEL = "anthropic/claude-haiku-4.5";
    replies = ["Здравствуйте!"];
    await call({ mode: "chat", messages: [], plan: [] });
    expect(bodies[0]).toMatchObject({ max_tokens: 320, temperature: 0.7 });
    expect(bodies[0].reasoning).toBeUndefined();
  });
});

describe("v67: подсказка Наставника — постоянная часть (кэш) и личная", () => {
  const anna = { name: "Анна", position: "waiter", restaurant: "Два моря, Океан" };
  const petr = { name: "Пётр", position: "manager", restaurant: "Порт" };
  const REG = "• Хлеб: подаём сразу, бесплатно";
  it("постоянная часть одна на всех: у Анны и Петра из разных ресторанов — слово в слово", () => {
    const a = chat.buildSystemParts(anna, REG), p = chat.buildSystemParts(petr, "");
    expect(a.stable).toBe(p.stable);
    expect(a.stable.length).toBeGreaterThan(50000);   // в кэш уходит почти вся подсказка
    for (const x of ["Анна", "Океан", "Собеседник:", REG]) expect(a.stable).not.toContain(x);
  });
  it("личная часть — в конце: кто спрашивает, его позиция, регламенты ресторана", () => {
    const a = chat.buildSystemParts(anna, REG);
    expect(a.personal).toContain("═ КТО СПРАШИВАЕТ ═");
    expect(a.personal).toContain("Собеседник: Анна (официант, ресторан «Два моря, Океан»). Его позиция сейчас — «официант»");
    expect(a.personal).toContain("═ РЕГЛАМЕНТЫ ИМЕННО ТВОЕГО РЕСТОРАНА (высший приоритет — важнее общих правил выше) ═\n" + REG);
    expect(a.personal).toContain("сначала сверься с регламентами твоего ресторана (блок выше)");
    expect(chat.buildSystemParts(anna, "").personal).not.toContain("РЕГЛАМЕНТЫ");
    expect(a.personal.length).toBeLessThan(1200);
    expect(chat.buildSystem(anna, REG)).toBe(a.stable + "\n\n" + a.personal);
  });
  it("в постоянной части — ссылка на «КТО СПРАШИВАЕТ» и «ДОСТУП ПО РОЛЯМ» без позиции", () => {
    const s = chat.buildSystemParts(anna, "").stable;
    expect(s).toContain("Кто спрашивает — его имя, позиция и ресторан — и регламенты его ресторана указаны в самом конце, в блоке «КТО СПРАШИВАЕТ».");
    expect(s).toContain("ДОСТУП ПО РОЛЯМ: позиция сотрудника — в блоке «КТО СПРАШИВАЕТ» в конце.");
  });
  it("карта приложения — как сейчас: «AI» посередине нижнего меню, у руководителей в ленте «AI-интервью»", () => {
    const s = chat.buildSystemParts(anna, "").stable;
    expect(s).toContain("Круглая кнопка «AI» посередине нижнего меню (на компьютере — в меню слева) — это я.");
    expect(s).not.toContain("внизу справа — это я");
    expect(s).toContain("Чек-листы (у руководителей ещё «AI-интервью» для кандидатов) и красный круг SOS");
  });
});

describe("v67: запрос Наставнику — кэш у Claude", () => {
  const parts = chat.buildSystemParts({ name: "Анна", position: "waiter", restaurant: "Два моря, Океан" }, "");
  const hist = [{ role: "assistant", content: "Привет! Чем помочь?" }, { role: "user", content: "Как предложить десерт?" }];
  it("Haiku 5.5: постоянная часть — с кэшем на час, личная — после; последняя реплика — кэш на 5 минут", () => {
    const b = chat.mentorRequest("anthropic/claude-haiku-5.5", parts, false, hist);
    const sys = b.messages[0];
    expect(sys.role).toBe("system");
    expect(sys.content[0]).toEqual({ type: "text", text: parts.stable, cache_control: { type: "ephemeral", ttl: "1h" } });
    expect(sys.content[1]).toEqual({ type: "text", text: parts.personal });
    const last = b.messages[b.messages.length - 1];
    expect(last).toEqual({ role: "user", content: [{ type: "text", text: "Как предложить десерт?", cache_control: { type: "ephemeral" } }] });
    // срез истории начался с ответа Наставника — первой идёт реплика сотрудника
    expect(b.messages[1]).toEqual({ role: "user", content: "Привет!" });
    // текстом — лёгкие размышления (на простой вопрос модель не думает), запас под них
    expect(b).toMatchObject({ model: "anthropic/claude-haiku-5.5", max_tokens: 4702, reasoning: { effort: "low", exclude: true } });
    expect(b.temperature).toBeUndefined();
  });
  it("голосом — режим голоса в личной части, без размышлений (пауза в разговоре), лимит 378", () => {
    const b = chat.mentorRequest("anthropic/claude-haiku-5.5", parts, true, hist);
    expect(b.messages[0].content[1].text).toContain("═ РЕЖИМ ГОЛОСА");
    expect(b.messages[0].content[0].text).not.toContain("РЕЖИМ ГОЛОСА");   // постоянная часть та же — кэш общий
    expect(b.max_tokens).toBe(378);
    expect(b.reasoning).toEqual({ enabled: false });
  });
  it("Haiku 4.5 — кэш тот же, параметры прежние (temperature 0.6, лимит 520)", () => {
    const b = chat.mentorRequest("anthropic/claude-haiku-4.5", parts, false, hist);
    expect(b.messages[0].content[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
    expect(b).toMatchObject({ temperature: 0.6, max_tokens: 520 });
  });
  it("не Claude (бесплатные модели) — подсказка одной строкой, без пометок кэша", () => {
    const b = chat.mentorRequest("qwen/qwen3-235b-a22b:free", parts, false, hist);
    expect(typeof b.messages[0].content).toBe("string");
    expect(b.messages[0].content).toBe(parts.stable + "\n\n" + parts.personal);
    expect(JSON.stringify(b)).not.toContain("cache_control");
    expect(b).toMatchObject({ temperature: 0.6, max_tokens: 520 });
  });
  it("сколько прочитано из кэша — в журнал функции", () => {
    expect(chat.cacheStat({ prompt_tokens: 30000, completion_tokens: 300, prompt_tokens_details: { cached_tokens: 28000, cache_write_tokens: 1500 } })).toEqual({ in: 30000, cached: 28000, written: 1500, out: 300 });
    expect(chat.cacheStat(null)).toBe(null);
    const src = rd("supabase/functions/ai-chat/index.ts");
    expect(src).toContain('if (cs) console.log("ai-chat usage", m, isGuest ? (finish ? "receipt" : "guest") : "mentor", JSON.stringify(cs));');
  });
  it("«Живой гость» и разбор — те же правила моделей (genOpts); версия функции — 67", () => {
    const src = rd("supabase/functions/ai-chat/index.ts");
    expect(src).toContain("body: JSON.stringify({ model: m, ...genOpts(m, 180, 0.8), stream: true, messages: guestMsgs }),");
    expect(src).toContain('? { model: m, ...genOpts(m, 700, 0.2, "low"),');
    expect(src).toContain(": { model: m, ...genOpts(m, 180, 0.8),");
    expect(src).toContain(": mentorRequest(m, buildSystemParts(emp, reglaments), !!voice, history)),");
    expect(src).not.toMatch(/temperature: 0\.[0-9],?\s*$/m);
    expect(chat.AI_CHAT_V).toBe(67);
  });
});

describe("v67: проверка AI HR — для той модели, на которой её прошли", () => {
  const twenty = Array.from({ length: 20 }, (_, i) => ({ aiCategory: "Рекомендован", decision: "hire", date: new Date(Date.UTC(2026, 9, 1, i)).toISOString() }));
  const ref = { n: 22, match: 22, missed: 0, pass: true, model: "anthropic/claude-haiku-4.5", at: "2026-10-21T03:20:00.000Z" };
  it("название модели без поставщика, даты и «:free»", () => {
    expect(modelKey("anthropic/claude-haiku-5.5-20261007")).toBe("claude-haiku-5.5");
    expect(modelKey("qwen/qwen3:free")).toBe("qwen3");
  });
  it("после проверки интервью вела другая модель — итог устарел, «бета» вернулась", () => {
    const after = { aiV: 2, aiModel: "anthropic/claude-haiku-5.5", date: "2026-10-21T05:00:00.000Z", aiCategory: "Рекомендован" };
    const s = hrStatus(ref, [...twenty, after]);
    expect(s).toMatchObject({ stale: true, refOk: false, beta: true, cur: "anthropic/claude-haiku-5.5" });
    expect(latestModel([after])).toEqual({ model: "anthropic/claude-haiku-5.5", date: after.date });
  });
  it("проверили заново на новой модели (позже интервью) — снова засчитано; та же модель — тоже", () => {
    const before = { aiV: 2, aiModel: "anthropic/claude-haiku-4.5", date: "2026-10-21T02:00:00.000Z" };
    expect(hrStatus({ ...ref, model: "anthropic/claude-haiku-5.5" }, [...twenty, before])).toMatchObject({ stale: false, refOk: true, beta: false });
    const same = { aiV: 2, aiModel: "anthropic/claude-haiku-4.5-20251001", date: "2026-10-21T06:00:00.000Z" };
    expect(hrStatus(ref, [...twenty, same]).stale).toBe(false);
    expect(hrStatus(ref, twenty).stale).toBe(false);   // интервью v2 ещё не было — сравнивать не с чем
  });
  it("на экране: строка «AI HR» и «Проверка AI HR» говорят, что проверить заново", () => {
    expect(rd("ui/candidate.jsx")).toContain('(hrSt.stale ? "проверить на новой модели" : `${hrSt.ref.match} из ${hrSt.ref.n}`)');
    expect(rd("ui/hr-eval.jsx")).toContain("а интервью теперь ведёт {shortModel(status.cur)} — запустите проверку ещё раз");
  });
});

describe("v67: метка и описание", () => {
  it("«сборка v67», «Дополнение 380», инструкция перехода", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2}<\/span>/);   // v68 — следующая метка
    expect(rd("CHANGES.md")).toContain("# Дополнение 380");
    const s = rd("supabase/AI-SETUP.md");
    expect(s).toContain("anthropic/claude-haiku-5.5");
    expect(s).toContain("## Переход на Claude Haiku 5.5 (v67)");
  });
});
