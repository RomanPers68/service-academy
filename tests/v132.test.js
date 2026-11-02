// v132 (Доп. 445): «Сомелье» умнее. Владелец (03.11): «Как мы сомелье можем сделать умнее?» — на одиннадцать предложений
// «Берём все». lib/taste.js и ui/taste.jsx (вкус по шкалам), lib/sommelier.js (блюдо целиком, правила сочетаний, тело и
// страна в просьбе, уточнение, «Полегче / Насыщеннее / …», «Подороже», правила дома и «советуем первым», что у нас берут,
// стол из нескольких блюд, вся карта Наставнику и ответ JSON), ui/bar-sommelier.jsx, supabase/functions/ai-chat (режим
// «Сомелье»), supabase/supabase-stage47-sommelier.sql (сверка — tools/claude/pg-check-stage47.mjs), api/wine-import.js
// (mode "taste"), демо; e2e — tools/claude/e2e-v132.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import * as W from "../lib/wine.js";
import * as Sp from "../lib/spirit.js";
import * as S from "../lib/sommelier.js";
import * as TS from "../lib/taste.js";
import { menuDishes } from "../lib/menu-dishes.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";
import { STAGES } from "../lib/server-check.js";

if (!globalThis.Deno) globalThis.Deno = { serve() {}, env: { get: () => "" } };
const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const nb = (s) => String(s).replace(/ /g, " ");
const T = { screen: {}, modCard: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modArrow: {}, para: {}, doneBtn: {} };
const strip = (html) => html.replace(/<!-- -->/g, "");

const wines = [
  W.normWine({ id: "w-cha", name: "Шабли", country: "Франция", region: "Бургундия", grapes: ["шардоне"], color: "white", sweet: "сухое", byGlass: true, priceGlass: 950, priceBottle: 5200,
    notes: ["яблоко", "мел"], short: "Свежее и минеральное.", story: "Шабли — самый север Бургундии.", temp: "8–10 °C", glass: "бургундия", taste: { body: 2, acid: 5, tannin: 1, sweet: 1, oak: 1 } }),
  W.normWine({ id: "w-mal", name: "Мальбек", country: "Аргентина", grapes: ["мальбек"], color: "red", sweet: "сухое", byGlass: true, priceGlass: 690, priceBottle: 4200, taste: { body: 4, acid: 3, tannin: 4, sweet: 1, oak: 3, ai: 1 } }),
  W.normWine({ id: "w-pin", name: "Пино Нуар", country: "Франция", grapes: ["пино нуар"], color: "red", sweet: "сухое", byGlass: true, priceGlass: 1100, priceBottle: 6100 }),
  W.normWine({ id: "w-ris", name: "Рислинг", country: "Германия", grapes: ["рислинг"], color: "white", sweet: "полусухое", byGlass: true, priceGlass: 780, priceBottle: 4300 }),
  W.normWine({ id: "w-pro", name: "Просекко", country: "Италия", grapes: ["глера"], color: "sparkling", sweet: "брют", byGlass: true, priceGlass: 650, priceBottle: 3600 }),
  W.normWine({ id: "w-mos", name: "Москато", country: "Италия", grapes: ["москато"], color: "dessert", sweet: "сладкое", byGlass: true, priceGlass: 590, priceBottle: 3300 }),
  W.normWine({ id: "w-bar", name: "Бароло", country: "Италия", grapes: ["неббиоло"], color: "red", sweet: "сухое", priceBottle: 14500 }),
];
const dishes = [
  { id: "d1", name: "Стейк рибай", cat: "Горячее", desc: "Мраморная говядина на гриле", ingredients: ["говядина", "соль"], pairing: "Красное с танинами" },
  { id: "d2", name: "Крабовая котлета", cat: "Горячие блюда", desc: "Сливочная текстура, томатный акцент", ingredients: ["краб", "сливочное масло", "моцарелла"] },
  { id: "d3", name: "Кальмар в азиатском стиле", cat: "Закуски", desc: "Острый соус чили", ingredients: ["кальмар", "чили"] },
  { id: "d4", name: "Тирамису", cat: "Десерты", ingredients: ["маскарпоне", "кофе"] },
];
const ctx = { dishes, wines };
const pool = S.somPool({ wines });
const ask = (t, x = {}) => ({ ...S.somAsk(t, ctx), ...x });
const top = (t, x = {}, o = {}) => S.somShortlist(pool, ask(t, x), { what: "wine", limit: 7, ...o }).list;
const dishName = (id) => (dishes.find((d) => d.id === id) || {}).name || "";

describe("v132: вкус по шкалам", () => {
  it("шкалы 1–5 (0 — не знаем), у вина и у крепкого свои; пометка ИИ внутри; без шкал — поля нет", () => {
    expect(TS.normTaste({ body: 4.4, acid: "3", tannin: 9, sweet: 0, oak: 2, ai: true }, "wine")).toEqual({ body: 4, acid: 3, tannin: 0, sweet: 0, oak: 2, ai: 1 });
    expect(TS.normTaste({ body: 0 }, "wine")).toBe(null);
    expect(TS.normTaste({ smoke: 5, body: 3 }, "spirit")).toEqual({ body: 3, sweet: 0, smoke: 5, oak: 0, spice: 0 });
    expect(TS.tasteLine(wines[0].taste)).toBe("тело 2/5 · кислотность 5/5 · танины 1/5 · сладость 1/5 · дуб 1/5");
    expect([TS.axisWord("wine", "acid", 5), TS.axisWord("wine", "body", 1), TS.axisWord("wine", "oak", 3), TS.axisWord("spirit", "smoke", 4)]).toEqual(["яркая", "лёгкое", "средне", "дымный"]);
    expect(TS.tasteConfirmed({ body: 2, ai: 1 })).toEqual({ body: 2 });
    expect(wines[1].taste.ai).toBe(1);
    expect("taste" in wines[2]).toBe(false);   // нет шкал — нет и поля (прежние записи не меняются)
    expect(Sp.normSpirit({ name: "Lagavulin", cat: "whisky", taste: { smoke: 5 } }).taste).toEqual({ body: 0, sweet: 0, smoke: 5, oak: 0, spice: 0 });
    expect(wines[1].ai).toEqual([]);   // шкалы от ИИ не делают вино «непроверенным»: команда учит его, как раньше
  });
});

describe("v132: блюдо целиком и правила сочетаний", () => {
  it("профиль блюда: мясо, рыба и морепродукты, жирное, острое, сладкое; вес", () => {
    const on = (d) => Object.entries(S.dishProfile([d])).filter(([, v]) => v).map(([k]) => k).join(",");
    expect(on(dishes[0])).toBe("red,smoky,heavy");
    expect(on(dishes[1])).toBe("sea,fat,acid,light");
    expect(on(dishes[2])).toBe("sea,spicy,light");
    expect(on(dishes[3])).toBe("sweet");   // «маскарпоне» — не рыба
    expect(S.dishProfile([])).toBe(null);
  });
  it("к рибаю — красное с танинами; к крабовой котлете — свежее и с пузырьками; к острому — рислинг; к десерту — сладкое", () => {
    const r1 = top("к рибаю");
    expect(r1[0].id).toBe("w-mal");
    expect(r1[0].why[0]).toBe("к мясу: танины и тело");
    expect(top("к «Крабовая котлета»").slice(0, 2).map((c) => c.id).sort()).toEqual(["w-cha", "w-pro"]);
    expect(top("к «Кальмар в азиатском стиле»")[0].id).toBe("w-ris");
    expect(top("к тирамису")[0].id).toBe("w-mos");
    expect(top("к тирамису").slice(-1)[0].s).toBeLessThan(0);
  });
  it("тело, свежесть, дуб и страна — из просьбы; размытая просьба — сначала уточнить", () => {
    const a = ask("что-то лёгкое и свежее, без дуба, итальянское");
    expect([a.body, a.fresh, a.oak, a.countries]).toEqual(["light", true, "no", ["итал"]]);
    expect(a.words).toEqual([]);
    expect(top("что-нибудь насыщенное")[0].id).toBe("w-mal");
    expect(top("итальянское").slice(0, 3).every((c) => c.rec.country === "Италия")).toBe(true);
    expect(S.needsClarify(ask("что-нибудь хорошее"))).toBe(true);
    for (const t of ["красное", "к рибаю", "бокалом", "лёгкое", "что-нибудь фруктовое", "итальянское", "виски"]) expect(S.needsClarify(ask(t)), t).toBe(false);
  });
});

describe("v132: уточнение, «Подороже», правила дома, что у нас берут", () => {
  it("«Полегче» после Мальбека — легче его; «Другая страна» — не Аргентина; «Подороже» — на ступень выше; что можно уточнить", () => {
    const a = ask("к рибаю"), shown = top("к рибаю").slice(0, 1);
    const light = S.somShortlist(pool, { ...a, refine: S.refineOf("light", shown) }, { what: "wine", exclude: ["wine:w-mal"] }).list;
    expect(light[0].id).toBe("w-pin");
    const other = S.somShortlist(pool, { ...a, refine: S.refineOf("country", shown) }, { what: "wine", exclude: ["wine:w-mal"] });
    expect(other.list.every((c) => c.country !== "аргентина")).toBe(true);
    const up = S.somShortlist(pool, { ...a, refine: S.refineOf("up", shown) }, { what: "wine", exclude: ["wine:w-mal"] });
    expect(up.list.map((c) => c.id).sort()).toEqual(["w-cha", "w-pin", "w-ris"]);   // дороже 4 200 и не дороже 9 240 (Бароло — уже не ступень)
    const top1 = S.somShortlist(pool, { ...a, refine: S.refineOf("up", [pool.find((c) => c.id === "w-bar")]) }, { what: "wine", exclude: ["wine:w-bar"] });
    expect(top1.none).toBe("Дороже под эту просьбу в карте ничего нет: показанное и так на верхней ступени.");
    expect(S.refineAvail(pool, a, "wine", shown, ["wine:w-mal"])).toEqual({ light: 5, full: 0, dry: 0, sweet: 2, country: 6, up: 3 });
  });
  it("правила дома и «советуем первым» — одна запись в меню команды; в меню блюд её нет; ★ поднимает позицию", () => {
    const arr = S.withSomRules([{ id: "d1", name: "Стейк" }], { text: "К стейкам сначала Мальбек  ", prio: ["wine:w-pin", "wine:w-pin"], by: "Мария Ким", at: 5 });
    expect(arr[1]).toEqual({ id: "__somrules__", kind: "somrules", text: "К стейкам сначала Мальбек", prio: ["wine:w-pin"], by: "Мария Ким", at: 5 });
    expect(S.readSomRules(arr)).toEqual({ text: "К стейкам сначала Мальбек", prio: ["wine:w-pin"], by: "Мария Ким", at: 5 });
    expect(S.withSomRules(arr, { text: "", prio: [] })).toEqual([{ id: "d1", name: "Стейк" }]);
    expect(menuDishes({ restaurant: "R", shared: arr, samples: {} }).map((d) => d.id)).toEqual(["d1"]);
    const r = top("к рибаю", { prio: new Set(["wine:w-pin"]) });
    expect(r.find((c) => c.id === "w-pin").why).toContain("ресторан советует первым");
  });
  it("«Гость взял»: к этому блюду у нас брали — выше; журнал телефона = сводке сервера; для Наставника — словами", () => {
    const now = Date.now();
    const log = [{ ev: "run", t: now }, { ev: "taken", item: "wine:w-pin", dishes: ["d1"], t: now }, { ev: "taken", item: "wine:w-pin", dishes: ["d1"], t: now - 864e5 },
      { ev: "declined", item: "wine:w-mal", dishes: ["d1"], t: now }, { ev: "taken", item: "wine:w-cha", dishes: [], t: now - 200 * 864e5 }];
    const st = S.statsFromLog(log, 90, now);
    expect([st.runs, st.taken, st.declined, st.items, st.pairs]).toEqual([1, 2, 1, [{ item: "wine:w-pin", taken: 2, declined: 0 }, { item: "wine:w-mal", taken: 0, declined: 1 }], [{ dish: "d1", item: "wine:w-pin", taken: 2 }]]);
    const idx = S.statsIndex(st);
    const r = top("к рибаю", { stats: idx });
    expect(r[0].id).toBe("w-pin");
    expect(r[0].why).toContain("к этому блюду у нас уже брали: 2 раза");
    expect(S.statsText(ask("к рибаю"), idx, pool)).toBe("к «Стейк рибай» брали: Пино Нуар (2); чаще всего берут: Пино Нуар (2)");
  });
});

describe("v132: стол, вся карта Наставнику, ответ JSON", () => {
  it("«на стол: «A», «B», бокал к каждому» — к каждому блюду свой список; без Наставника — по позиции на блюдо", () => {
    const a = ask("на стол: «Стейк рибай», «Крабовая котлета», бокал к каждому");
    expect([a.table.dishes.map((d) => d.id), a.table.each]).toEqual([["d1", "d2"], true]);
    const g = S.tableLists(pool, a, { what: "wine" });
    expect(g[0].list[0].id).toBe("w-mal");
    expect(["w-cha", "w-pro"]).toContain(g[1].list[0].id);   // к крабовой котлете — свежее белое или игристое
    expect(S.localTable(g).map((p) => p.id + "@" + p.dish)).toEqual(["w-mal@1", g[1].list[0].id + "@2"]);
    expect(S.assignTable([{ ...g[0].list[0] }, { ...g[1].list[0] }], g).map((p) => p.dish)).toEqual([1, 2]);
    expect(ask("на стол: «Стейк рибай», «Крабовая котлета»").table.each).toBe(false);
  });
  it("для режима «Сомелье»: просьба, блюдо целиком (описание, состав, «сочетание» из меню), правила, что берут, вся карта с ★ и шкалами", () => {
    const a = ask("к рибаю", { prio: new Set(["wine:w-mal"]) }), list = S.somShortlist(pool, a, { what: "wine", limit: 120 }).list;
    const p = S.somPayload(a, list, { dishName, rules: "К стейкам сначала Мальбек", prio: a.prio, stats: "к «Стейк рибай» брали: Мальбек (3)", prev: [], refine: S.refineOf("up", [list[0]]) });
    expect(p.ask).toBe("к рибаю");
    expect(p.dish).toBe("Стейк рибай; Горячее; Мраморная говядина на гриле; говядина соль; в меню к нему советуют: Красное с танинами");
    expect(p.refine).toBe("гость готов на чуть больше: предложи на ступень дороже, фразой без давления, начни её с «Если хочется чего-то особенного»");
    expect(p.card.length).toBe(7);
    expect(nb(p.card[0])).toBe("★ Вино · Мальбек · Аргентина · мальбек · красное сухое · бокал 690 ₽ · бутылка 4 200 ₽ · вкус: тело 4/5 · кислотность 3/5 · танины 4/5 · сладость 1/5 · дуб 3/5");
    const t = ask("на стол: «Стейк рибай», «Крабовая котлета», бокал к каждому"), g = S.tableLists(pool, t, { what: "wine" });
    const pt = S.somPayload(t, g.flatMap((x) => x.list).filter((c, i, arr) => arr.findIndex((y) => y.id === c.id) === i), { dishName, groups: g });
    expect(pt.dish).toBe("");
    expect(pt.table).toMatch(/^1\) Стейк рибай; .+ \|\| 2\) Крабовая котлета; .+\. Бокал к каждому блюду: по одной позиции на блюдо, в поле dish — номер блюда$/);
    expect(pt.card.every((l) => / · к блюду \d(, \d)*$/.test(l))).toBe(true);
  });
  it("ответ JSON: номер из карты, почему, фраза, коротко, с историей, подача, блюдо стола; чужой номер — мимо; не JSON — null", () => {
    const list = S.somShortlist(pool, ask("к рибаю"), { what: "wine", limit: 20 }).list;
    const r = S.parseSomJson('Вот: {"picks":[{"n":1,"dish":0,"why":"Танины к мясу.","say":"«К рибаю советую Мальбек»","short":"Мальбек к стейку","story":"","serve":"16–18 °C, бокал «бордо»"},{"n":99},{"n":1}],"note":""}', list);
    expect(r.picks.map((p) => [p.id, p.why, p.say, p.short, p.story, p.serveAi, p.dish])).toEqual([["w-mal", "Танины к мясу.", "К рибаю советую Мальбек", "Мальбек к стейку", "", "16–18 °C, бокал «бордо»", 0]]);
    expect(S.parseSomJson("[[pick:1]] Почему: так", list)).toBe(null);
    expect(S.parseSomJson('{"picks":[],"note":"Нет красного."}', list)).toEqual({ picks: [], note: "Нет красного." });
  });
});

describe("v132: сервер", () => {
  it("ai-chat: режим «Сомелье» — своя подсказка (правила сочетаний, ★, «берут у нас», JSON), вся карта под номерами с пределами; версия 78", async () => {
    const A = await import("../supabase/functions/ai-chat/index.ts");
    expect(A.AI_CHAT_V).toBeGreaterThanOrEqual(78);
    const sys = A.somSystem("Два моря");
    expect(sys.split("\n")[0]).toBe("Ты сомелье ресторана «Два моря». Помогаешь официанту подобрать гостю напиток из барной карты заведения.");
    for (const x of ["Выбирай только из пронумерованного списка «Карта»", "красное мясо и гриль — танины и тело", "звёздочкой ★", "«Берут у нас»", "Ответ — только JSON", '"story":', '"serve":', "в поле dish"]) expect(sys, x).toContain(x);
    const u = A.somUser({ ask: "к рибаю", dish: "Стейк рибай", rules: "К стейкам сначала Мальбек", stats: "брали Мальбек (3)", refine: "гость просит полегче", prev: "Бароло", card: ["Вино · Мальбек", "Вино · Пино"] });
    expect(u).toBe("Просьба гостя: к рибаю\nБлюдо из нашего меню: Стейк рибай\nУточнение: гость просит полегче\nУже предлагали: Бароло\nКак у нас принято: К стейкам сначала Мальбек\nБерут у нас: брали Мальбек (3)\nКарта (что подходит под просьбу: не в стопе, в бюджете), позиций: 2\n1. Вино · Мальбек\n2. Вино · Пино");
    const big = A.somUser({ ask: "x".repeat(900), card: Array.from({ length: 400 }, (_, i) => "Вино " + i + " " + "я".repeat(300)) });
    expect(big.split("\n")[0].length).toBe("Просьба гостя: ".length + 400);
    expect((big.match(/^\d+\. /gm) || []).length).toBeLessThanOrEqual(200);
    expect(big.length).toBeLessThan(26000);
    const r = A.somRequest("anthropic/claude-haiku-5.5", "Два моря", { ask: "к рибаю", card: ["Вино · Мальбек"] });
    expect(r.messages.map((m) => m.role)).toEqual(["system", "user"]);
    const src = rd("supabase/functions/ai-chat/index.ts");
    expect(src).toContain('const somIn = !isGuest && mode === "sommelier" && reqBody?.som && typeof reqBody.som === "object" ? reqBody.som as Record<string, unknown> : null;');
    expect(src).toContain(": somIn ? somRequest(m, String(emp.restaurant || \"\"), somIn)   // v132");
    expect(src).toContain("if (reply && somIn) { winner = m; return json({ ok: true, reply, model: data?.model || m, remaining, v: AI_CHAT_V, som: 1 }); }");
  });
  it("этап 47: журнал и сводка (как в демо), «Сервер» видит этап по som_log_add; демо без этапа — 404", () => {
    const sql = rd("supabase/supabase-stage47-sommelier.sql");
    for (const x of ["create table if not exists sa_som_log", "create or replace function som_log_add(p_token text, p_ev text, p_item text default '', p_dishes text[] default '{}'::text[], p_ask text default '')",
      "create or replace function som_stats(p_token text, p_days int default 90)", "interval '10 minutes'", ">= 300", "revoke all on table sa_som_log from public, anon, authenticated;", "notify pgrst, 'reload schema';"]) expect(sql, x).toContain(x);
    expect(STAGES.find((x) => x.n === "47")).toEqual({ n: "47", file: "supabase-stage47-sommelier.sql", what: "Сомелье учится: взял / не взял", fn: "som_log_add" });
    const people = [{ id: "e-anna", name: "Анна", surname: "С", restaurant: "R", position: "waiter", is_admin: false }];
    const srv = makeServer({ today: "2026-11-03", rest: "R", people, tok: { "tok-a": "e-anna" }, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false });
    expect(srv.rpc("som_log_add", { p_token: "tok-a", p_ev: "taken", p_item: "wine:w-pin", p_dishes: ["d1"], p_ask: "к рибаю" })).toEqual({ ok: true });
    expect(srv.rpc("som_log_add", { p_token: "tok-a", p_ev: "taken", p_item: "плохо" })).toEqual({ ok: false, error: "item" });
    const st = srv.rpc("som_stats", { p_token: "tok-a" });
    expect([st.ok, st.taken, st.pairs]).toEqual([true, 1, [{ dish: "d1", item: "wine:w-pin", taken: 1 }]]);
    const s0 = makeServer({ today: "2026-11-03", rest: "R", people, tok: { "tok-a": "e-anna" }, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, noStage47: true });
    expect(s0.rpc("som_stats", { p_token: "tok-a" }).code).toBe("PGRST202");
    expect(rd("tools/claude/pg-check-stage47.mjs")).toContain("сводка демо совпадает с базой");
  });
  it("api/wine-import: mode «taste» — до 25 позиций, шкалы 1–5 (у крепкого — дым и пряность)", () => {
    const src = rd("api/wine-import.js");
    expect(src).toContain('if (b.mode === "taste") {');
    expect(src).toContain('const keys = spT ? ["body", "sweet", "smoke", "oak", "spice"] : ["body", "acid", "tannin", "sweet", "oak"];');
    expect(src).toContain("return res.status(200).json({ tastes, model: out.model });");
  });
});

describe("v132: экран", () => {
  const sh = (wn) => [...wn];
  it("ответ: шкалы, «Почему», фраза гостю на выбор (коротко, обычно, с историей), подача, как сказать и «Послушать», «Гость взял / Не взял», ★ руководителю, уточнения", async () => {
    const { BarSommelier } = await import("../ui/bar-sommelier.jsx");
    const p = { ...pool.find((c) => c.id === "w-cha"), why: "Кислотность к сливочному.", say: "К котлете советую Шабли", short: "Шабли, свежее", story: "Шабли — самый север Бургундии.", serveAi: "8–10 °C, бокал «бургундия»" };
    const keep = { text: "к «Крабовая котлета»", what: "wine", seen: ["wine:w-cha"], marks: { "wine:w-cha": "taken" }, res: { how: "new", text: "к «Крабовая котлета»", what: "wine", total: 5, mode: "ai", remaining: 12, picks: [p], dishIds: ["d2"] } };
    const team = [S.withSomRules([], { text: "К рыбе сначала белое", prio: ["wine:w-cha"] }), () => {}];
    const html = nb(strip(renderToString(React.createElement(BarSommelier, { T, a11y: false, restaurant: "R", cocktails: [], wines: sh(wines), spirits: [], keep, team, edit: true, onBack: () => {}, onOpen: () => {}, onShareChat: () => {} }))));
    for (const x of ['data-som-pick="wine:w-cha"', 'data-som-marked="taken"', 'data-taste="wine"', "Почему: </span>Кислотность к сливочному.", 'data-som-say="say"', "Гостю: «К котлете советую Шабли»",
      'data-som-var="short"', 'data-som-var="story"', "Подача: </span>8–10 °C, бокал «бургундия»", 'data-som-name="Шабли́"', "Как сказать: </span>Шабли́", ">Гость взял ✓<", ">Не взял<",
      'data-som-prio="on"', ">★ Первым<", "Вино · советуем первым", 'data-som-admin=""', "К рыбе сначала белое", "Советуем первым: Шабли.", 'data-som-taste-n="2"', "Заполнить через ИИ: 5"]) expect(html, x).toContain(x);
    const h2 = nb(strip(renderToString(React.createElement(BarSommelier, { T, a11y: true, restaurant: "R", cocktails: [], wines: sh(wines), spirits: [], keep: { text: "что-нибудь хорошее", what: "wine", res: { how: "new", text: "что-нибудь хорошее", what: "wine", mode: "clarify", picks: [], total: 0, at: 1 } }, team, edit: false, onBack: () => {}, onOpen: () => {} }))));
    for (const x of ['data-som-clar=""', "Уточню, чтобы попасть точнее", ">Какое вино?<", 'data-som-clar-opt="красное"', 'data-som-clar-opt="лёгкое"', 'data-som-clar-go=""', 'data-som-rules-view=""', "К рыбе сначала белое"]) expect(h2, x).toContain(x);
    expect(h2).not.toContain("data-som-admin");
  });
  it("вкус в карточке вина и в редакторе; строки и точки", async () => {
    const { TasteBars, TasteEdit } = await import("../ui/taste.jsx");
    const b = strip(renderToString(React.createElement(TasteBars, { t: wines[1].taste, kind: "wine", gold: "#c8a96e", text: "#fff", sub: "#aaa" })));
    expect(b).toContain('data-taste-ai="1"');
    expect([...b.matchAll(/data-taste-axis="([a-z]+)" data-taste-v="(\d)"/g)].map((m) => m[1] + m[2]).join(",")).toBe("body4,acid3,tannin4,sweet1,oak3");
    expect(b).toContain(">плотное<");
    const e = strip(renderToString(React.createElement(TasteEdit, { kind: "spirit", value: null, onChange: () => {}, gold: "#c8a96e", text: "#fff", sub: "#aaa" })));
    expect((e.match(/data-taste-set=/g) || []).length).toBe(25);
    expect(e).toContain(">Дым<");
    expect(rd("ui/wine-list.jsx")).toContain("Шкалы от ИИ: руководитель ещё не проверил");
    expect(rd("ui/wine-editor.jsx")).toContain('<TasteEdit kind={K.kind} value={form.taste} onChange={(t) => setForm((x) => ({ ...x, taste: t }))} gold={gold} text={text} sub={sub} />');
  });
  it("«На стол» — фраза в поле; без блюд меню кнопки нет; гид; без тире-ритма и эмодзи; метка v132; документы", async () => {
    const { BarSommelier } = await import("../ui/bar-sommelier.jsx");
    const html = strip(renderToString(React.createElement(BarSommelier, { T, a11y: false, restaurant: "R", cocktails: [], wines: sh(wines), spirits: [], onBack: () => {}, onOpen: () => {} })));
    expect([...html.matchAll(/data-som-chip="([^"]+)"/g)].map((m) => m[1]).join(",")).toBe("glass,budget,like,occ-aperitif,occ-dessert,occ-digestif");
    const src = rd("ui/bar-sommelier.jsx");
    expect(src).toContain('const ph = "на стол: " + names.map((n) => "«" + n + "»").join(", ") + (each && names.length > 1 ? ", бокал к каждому" : "");');
    expect(rd("ui/guide.jsx")).toContain('{ key: "sommelier2", title: "Сомелье: умнее"');
    for (const f of ["ui/bar-sommelier.jsx", "lib/sommelier.js", "lib/taste.js", "ui/taste.jsx", "ui/wine-list.jsx", "ui/wine-editor.jsx", "ui/bar-card.jsx"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(13[2-9]|1[4-9]\d|[2-9]\d\d)<\/span>/);
    expect(rd("CHANGES.md")).toContain("# Дополнение 445 — «Сомелье» умнее (v132)");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v132.mjs` — v132 (Доп. 445)");
    for (const x of ["m45-som-json", "m46-som-table", "m47-som-admin"]) expect(rd("tools/claude/demo-app/check.mjs"), x).toContain(x);
  });
});
