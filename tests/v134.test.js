// v134 (Доп. 447): «Заполнить по названию» дописывает к тому, что уже есть. Владелец (03.11, снимок «Правки позиции»
// «Аберфелди 12» с красной строкой «Не получилось, попробуй ещё раз»): «если уже что-то заполнено, то AI не может
// дополнить?». lib/drinks.js (fillAsk, aiAdded), api/wine-import.js (known в подсказке, срок у модели), ui/wine-editor.jsx
// (ответ без JSON словами, «Дописано: …», «Дописывать нечего…»); e2e — tools/claude/e2e-v134.mjs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { WINE, SPIRIT, NO_ASK } from "../lib/drinks.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
// как у владельца: из карты пришли вид, страна, выдержка, порция и цена порции (помечены «AI»), остальное пусто
const ABER = { name: "АБЕРФЕЛДИ 12 ЛЕТ / ABERFELDY 12 YEARS", producer: "", cat: "whisky", style: "", country: "Шотландия", region: "", age: "12 лет", abv: "",
  portion: 40, pricePortion: 700, priceBottle: "", volume: "", serve: [], glass: "", temp: "", notes: [], short: "", story: "", ai: ["cat", "country", "age", "portion", "pricePortion"] };

describe("v134: что уже вписано, уходит AI фактами; AI пишет только пустое (lib/drinks.js)", () => {
  it("«Аберфелди 12»: known — вид, страна, выдержка; missing — остальное; цен и порции нет ни там, ни там", () => {
    const { known, missing } = SPIRIT.fillAsk(ABER);
    expect(known).toEqual({ cat: "whisky", country: "Шотландия", age: "12 лет" });
    expect(missing).toEqual(["producer", "style", "region", "abv", "volume", "serve", "glass", "temp", "notes", "short", "story"]);
    for (const f of NO_ASK) { expect(known).not.toHaveProperty(f); expect(missing).not.toContain(f); }
  });
  it("вино: регион, цвет и сорт — known (списки до шести, длинное обрезано); «бокалом» и цены — нет", () => {
    const { known, missing } = WINE.fillAsk({ name: "Бароло", region: "Ланге", color: "red", grapes: ["неббиоло", " "], byGlass: true, priceGlass: 900, priceBottle: 6000, story: "x".repeat(300), abv: 14 });
    expect(known).toEqual({ region: "Ланге", grapes: ["неббиоло"], color: "red", abv: 14, story: "x".repeat(60) });
    expect(missing).toEqual(["producer", "country", "sweet", "vintage", "volume", "temp", "glass", "notes", "short"]);
  });
  it("вписано всё, что AI знает по названию (пустые только цены) — missing пуст: запрос не нужен", () => {
    const full = { ...ABER, producer: "Aberfeldy", style: "односолодовый", region: "Хайленд", abv: 40, volume: "0,7 л", serve: ["чистым"], glass: "гленкерн", temp: "комнатная",
      notes: ["мёд"], short: "Медовый.", story: "Хайленд.", priceBottle: "" };
    expect(SPIRIT.fillAsk(full).missing).toEqual([]);
  });
  it("aiAdded — что AI дописал сейчас; вписанное (страна) AI не меняет; второй раз — ничего", () => {
    const after = SPIRIT.mergeAi(ABER, { producer: "Aberfeldy", country: "Великобритания", region: "Хайленд", abv: 40, notes: ["мёд"], pricePortion: 999 });
    expect(SPIRIT.aiAdded(ABER, after)).toEqual(["producer", "region", "abv", "notes"]);
    expect(after.country).toBe("Шотландия");
    expect(after.pricePortion).toBe(700);
    expect(SPIRIT.aiAdded(after, SPIRIT.mergeAi(after, { producer: "Другой", region: "Спейсайд" }))).toEqual([]);
    expect(WINE.aiAdded({ region: "Ланге", grapes: [] }, WINE.mergeAi({ name: "Б", region: "Ланге", grapes: [] }, { region: "Пьемонт", grapes: ["неббиоло"] }))).toEqual(["grapes"]);
  });
});

describe("v134: api/wine-import.js — известное в подсказке, срок у модели", () => {
  const real = globalThis.fetch;
  const ENV = ["OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "WINE_AI_EACH_MS", "WINE_AI_TOTAL_MS"];
  let handler, A, plan = [], prompts = [], models = [];
  const REPLY = JSON.stringify({ name: "Aberfeldy 12", producer: "Aberfeldy", cat: "whisky", country: "Великобритания", region: "Хайленд" });
  beforeAll(async () => {
    process.env.OPENROUTER_API_KEY = "sk-test"; process.env.WINE_AI_EACH_MS = "120"; process.env.WINE_AI_TOTAL_MS = "400";
    // модели по очереди: "ok" — ответ сразу, "slow" — через 250 мс, "hang" — молчит, пока запрос не отменят
    globalThis.fetch = async (url, init = {}) => {
      if (/rpc\/whoami/.test(url)) return { ok: true, json: async () => ({ ok: true, employee: { id: "u1", name: "Мария" } }) };
      const body = JSON.parse(init.body);
      models.push(body.model || "anthropic"); prompts.push((((body.messages || [])[0] || {}).content || [])[0].text);
      const how = plan.shift() || "ok";
      if (how === "hang") return new Promise((_, bad) => { if (init.signal) init.signal.addEventListener("abort", () => { const e = new Error("This operation was aborted"); e.name = "AbortError"; bad(e); }); });
      if (how === "slow") await new Promise((r) => setTimeout(r, 250));
      if (/anthropic\.com/.test(url)) return { ok: true, status: 200, json: async () => ({ model: "claude-sonnet-4-6", content: [{ text: REPLY }], stop_reason: "end_turn" }) };
      return { ok: true, status: 200, json: async () => ({ model: body.model, choices: [{ finish_reason: "stop", message: { content: REPLY } }] }) };
    };
    A = await import("../api/wine-import.js");
    handler = A.default;
  });
  afterAll(() => { globalThis.fetch = real; for (const k of ENV) delete process.env[k]; });
  const call = (body) => new Promise((ok) => { const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); return this; } }; handler({ method: "POST", body }, res); });
  const fresh = (p) => { plan = p; prompts = []; models = []; };

  it("fill с known: «Уже вписано в карточку…» и «Заполни только недостающее…»; цены и чужие ключи — мимо", async () => {
    fresh(["ok"]);
    const { code: c, j } = await call({ token: "t1", mode: "fill", kind: "spirit", name: ABER.name, known: { cat: "whisky", country: "Шотландия", age: "12 лет", pricePortion: 700, x: "y" } });
    expect(c).toBe(200);
    expect(prompts[0]).toContain("Помоги официанту с крепким напитком «АБЕРФЕЛДИ 12 ЛЕТ / ABERFELDY 12 YEARS» из барной карты ресторана.\nУже вписано в карточку (это верно, держись этого и не меняй): "
      + '{"cat":"whisky","country":"Шотландия","age":"12 лет"}.\nЗаполни только недостающее: producer, style, region, abv, volume, serve, glass, temp, notes, short, story. Вписанные поля в ответе оставь пустыми.\nВерни один JSON-объект:');
    expect(prompts[0]).not.toContain("700");
    expect(j.wines[0]).toMatchObject({ producer: "Aberfeldy", region: "Хайленд" });   // страну оставит приложение: mergeAi пишет только в пустое
  });
  it("fill без known — подсказка прежняя (вина и крепкое)", async () => {
    fresh(["ok", "ok"]);
    await call({ token: "t2", mode: "fill", kind: "spirit", name: "Jameson" });
    await call({ token: "t3", mode: "fill", name: "Шабли", known: "не объект" });
    expect(prompts[0]).toContain("«Jameson» из барной карты ресторана.\nВерни один JSON-объект:");
    expect(prompts[1]).toContain("«Шабли» из винной карты ресторана.\nВерни один JSON-объект:");
  });
  it("knownFacts: только поля карточки, списки до шести через запятую, строки до 120; factsText: всё вписано — без «Заполни»", () => {
    const k = A.knownFacts({ notes: ["мёд", "", "дуб"], story: "a".repeat(300), priceBottle: 5000, glass: " ", cat: "whisky" }, ["cat", "notes", "story", "glass"]);
    expect(k).toEqual({ cat: "whisky", notes: "мёд, дуб", story: "a".repeat(120) });
    expect(A.factsText({}, ["cat"])).toBe("");
    expect(A.factsText({ cat: "whisky" }, ["cat"])).toBe('\nУже вписано в карточку (это верно, держись этого и не меняй): {"cat":"whisky"}.');
  });
  it("первая модель молчит дольше срока — сразу следующая, ответ приходит", async () => {
    fresh(["hang", "ok"]);
    const t0 = Date.now();
    const { code: c, j } = await call({ token: "t4", mode: "fill", kind: "spirit", name: "Aberfeldy 12" });
    expect(c).toBe(200);
    expect(j.wines[0].producer).toBe("Aberfeldy");
    expect(models).toEqual(["anthropic/claude-sonnet-4.6", "google/gemini-2.5-flash"]);
    expect(Date.now() - t0).toBeLessThan(380);
  });
  it("молчат все — 504 словами («AI не успел ответить…»), не дольше общего срока", async () => {
    fresh(["hang", "hang"]);
    const t0 = Date.now();
    const { code: c, j } = await call({ token: "t5", mode: "fill", name: "Бароло" });
    expect(c).toBe(504);
    expect(j.error).toBe("AI не успел ответить: нажми ещё раз. Если повторится, подожди минуту");
    expect(Date.now() - t0).toBeLessThan(700);
  });
  it("по этикетке — тот же срок; списком и с листа — без срока (там ответ длинный)", async () => {
    fresh(["hang", "ok"]);
    expect((await call({ token: "t6", mode: "label", kind: "spirit", imageBase64: "a".repeat(100), mime: "image/jpeg" })).code).toBe(200);
    fresh(["slow"]);
    const r = await call({ token: "t7", mode: "names", kind: "spirit", names: ["Aberfeldy 12"] });
    expect(r.code).toBe(200);
    expect(models).toHaveLength(1);
  });
  it("только ключ Anthropic: молчит дольше общего срока — 504 тем же текстом", async () => {
    delete process.env.OPENROUTER_API_KEY; process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    try {
      fresh(["hang"]);
      const { code: c, j } = await call({ token: "t8", mode: "fill", name: "Бароло" });
      expect(c).toBe(504);
      expect(j.error).toMatch(/^AI не успел ответить/);
      fresh(["ok"]);
      expect((await call({ token: "t9", mode: "fill", name: "Бароло" })).code).toBe(200);
    } finally { process.env.OPENROUTER_API_KEY = "sk-test"; delete process.env.ANTHROPIC_API_KEY; }
  });
  it("в коде: срок только у одной позиции; известное — через knownFacts", () => {
    const S = rd("api/wine-import.js");
    expect(S).toContain('const lim = b.mode === "fill" || b.mode === "label" ? quickLim() : null;');
    expect(S).toContain("const out = orKey ? await viaOpenRouter(orKey, parts, max, lim) : await viaAnthropic(anKey, parts, max, lim);");
    expect(S).toContain("parts = [{ text: P.fill(name, factsText(knownFacts(b.known, keys), keys)) }];");
    expect(S).toContain('const quickLim = () => ({ each: Number(process.env.WINE_AI_EACH_MS) || 30000, total: Number(process.env.WINE_AI_TOTAL_MS) || 50000 });');
  });
});

describe("v134: редактор — ответ без JSON словами, что дописано, подпись у кнопки (ui/wine-editor.jsx)", () => {
  const E = rd("ui/wine-editor.jsx");
  it("aiWhy: 504 — «AI не успел ответить…», 5xx — «Сервер AI сейчас не отвечает…», 413, 404; ошибка нашего сервера — его текст", async () => {
    const { aiWhy } = await import("../ui/wine-editor.jsx");
    expect(aiWhy(504)).toBe("AI не успел ответить: сервер перестал ждать (код 504). Нажми ещё раз");
    expect(aiWhy(502)).toBe("Сервер AI сейчас не отвечает (код 502). Нажми ещё раз через минуту");
    expect(aiWhy(413)).toBe("Файл слишком большой для AI (код 413): раздели PDF или сними страницы фото");
    expect(aiWhy(404)).toBe("Функция AI не найдена на сервере (код 404): /api/wine-import не развёрнута");
    expect(aiWhy(429)).toBe("AI не ответил (код 429). Нажми ещё раз");
    expect(aiWhy(0)).toBe("AI ответил пусто. Нажми ещё раз");
    expect(E).toContain("if (r.ok && j && Array.isArray(j.wines)) return j;\n    if (j && j.error) throw new Error(j.error);\n    throw new Error(aiWhy(r.ok ? 0 : r.status));");
    expect(code(E)).not.toContain("Не получилось, попробуй ещё раз");
  });
  it("«Заполнить по названию»: в запросе known; пустого нет — «Дописывать нечего…» без запроса; после ответа — «Дописано: …» или «AI не знает…»", () => {
    expect(E).toContain("const { known, missing } = K.fillAsk(form);");
    expect(E).toContain('if (!missing.length) { setAiErr(""); setAiNote("Дописывать нечего: всё, что AI знает по названию, уже вписано"); vibrate("light"); return; }');
    expect(E).toContain('askAi({ mode: "fill", name, known })');
    expect(E).toContain('return added.length ? "Дописано: " + added.map((f) => K.FIELD_RU[f] || f).join(", ") : "AI не знает об этой позиции больше, чем уже вписано";');
    expect(E).toContain('{aiNote && !aiErr ? <div role="status" data-wine-ai-note=""');
    expect(E).toContain(">AI допишет пустые поля, заполненное не тронет</span>");
    expect(E).not.toContain("AI заполнит только пустые поля");
  });
  it("тексты: без тире-ритма и эмодзи; метка — v134", () => {
    for (const f of ["ui/wine-editor.jsx", "lib/drinks.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(Number((rd("ui/menu-trainer.jsx").match(/· сборка v(\d+)<\/span>/) || [])[1])).toBeGreaterThanOrEqual(134);
  });
});

describe("v134: раз в 10 минут, пока приложение открыто, — сверка сборки (main.jsx)", () => {
  // владелец смотрел v132, когда вышла v133: приложение было открыто, а сверка была только при открытии и возвращении
  const M = rd("main.jsx");
  it("таймер раз в 10 минут; скрытое — молчит; по таймеру — тост, один раз на сборку; при открытии — как раньше", () => {
    expect(M).toContain('setInterval(() => check("tick"), 10 * 60 * 1000);');
    expect(M).toContain('if (reason === "tick" && told === m[1]) return;');
    expect(M).toContain('if (document.visibilityState === "hidden") return;');
    expect(M).toContain('if (reason === "load") window.location.reload(); else announceUpdate();');
    expect(M.indexOf("told = m[1];")).toBeLessThan(M.indexOf("sessionStorage.setItem(KEY, String(Date.now()));"));
  });
});

describe("v134: демо, e2e, документы", () => {
  it("демо: «Аберфелди 12» из карты, «по названию» держится вписанного вида; проверка демо — m48", () => {
    const B = rd("tools/claude/demo-app/boot.js"), C = rd("tools/claude/demo-app/check.mjs");
    expect(B).toContain('{ name: "АБЕРФЕЛДИ 12 ЛЕТ / ABERFELDY 12 YEARS", cat: "whisky", country: "Шотландия", age: "12 лет", portion: 40, pricePortion: 700, ai: ["cat", "country", "age", "portion", "pricePortion"] },');
    expect(B).toContain('if (b.mode === "fill") return { wines: [guessSpirit(String(b.name || ""), b.known || null)] };');
    expect(C).toContain('await shot("m48-spirit-fill");');
  });
  it("e2e-v134: FILL, NONE, ERR, WINE, FEED, TICK; README, AI-SETUP, CHANGES", () => {
    const T = rd("tools/claude/e2e-v134.mjs");
    for (const s of ['await run("FILL"', 'await run("NONE"', 'await run("ERR"', 'await run("WINE"', 'await run("FEED"', 'await run("FEEDPAPER"', 'await run("TICK"']) expect(T, s).toContain(s);
    expect(rd("tools/claude/README.md")).toContain("- `e2e-v134.mjs` — v134 (Доп. 447)");
    expect(rd("supabase/AI-SETUP.md")).toContain("## v134: «Заполнить по названию» в «Барной карте» (`api/wine-import`)");
    expect(rd("CHANGES.md")).toContain("# Дополнение 447 — «Заполнить по названию» дописывает к тому, что уже есть (v134)");
  });
});
