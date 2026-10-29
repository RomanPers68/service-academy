// v93 (Доп. 406): умный чат. Карточки делают дело в приложении: смена (отдать или поменяться: график меняется сразу, без
// подтверждения, руководители видят каждую передачу), задание (урок, тест или тема: кто прошёл, «Напомнить»),
// «поделиться», опрос, стоп-лист (в Меню у всех), брифинг дня; Наставник отвечает в переписке на «@Наставник …»;
// подсказки по тексту. Оформление карточек — «Билет» (выбор владельца). Сервер — этап 38 (tools/claude/sql/test38.sh),
// демо — tools/claude/chat-demo, вид — tools/claude/e2e-v93.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const rd = (f) => readFileSync(f, "utf8");
const DASH = /[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const fnBody = (sql, name) => { const a = sql.indexOf("create or replace function " + name + "("); return a < 0 ? "" : sql.slice(a, sql.indexOf("end; $$;", a) < 0 ? sql.indexOf("$$;", a) : sql.indexOf("end; $$;", a)); };
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

describe("v93: расчёт умного чата (lib/chat-smart.js)", () => {
  it("смена глазами человека: моя — «Ждём»; можно — «Забрать»/«Поменяться»; нельзя — почему; закрыта — кто взял", async () => {
    const S = await import("../lib/chat-smart.js");
    const card = { t: "shift", mode: "give", date: "2026-10-30", from: "a", fromName: "Анна Смирнова", st: "open" };
    expect(S.shiftState(card, { id: "a" })).toMatchObject({ mine: true, act: "cancel", line: "Ждём, кто заберёт", head: "Отдаю смену" });
    expect(S.shiftState({ ...card, can: true }, { id: "p" })).toMatchObject({ act: "take", line: "Можешь забрать: в этот день у тебя нет смены по графику" });
    expect(S.shiftState({ ...card, can: false, why: "Забрать могут официанты, свободные в этот день" }, { id: "i" })).toMatchObject({ act: null, line: "Забрать могут официанты, свободные в этот день" });
    expect(S.shiftState({ ...card, st: "done", byName: "Пётр Иванов" }, { id: "x" })).toMatchObject({ done: true, act: null, line: "Пётр И. забирает смену · график обновлён" });
    const sw = { ...card, mode: "swap", st: "done", byName: "Пётр Иванов", byDate: "2026-11-02" };
    expect(S.shiftState(sw, { id: "x" }).line).toBe("Поменялись: Анна С. и Пётр И. (пт 30 и пн 2) · график обновлён");
    expect(S.shiftState({ ...card, st: "off" }, { id: "x" }).line).toBe("Предложение отменено");
    expect([S.wantLine(["2026-11-02", "2026-11-04"]), S.wantLine([])]).toEqual(["Взамен: пн 2, ср 4", "Взамен: любой день"]);
  });
  it("строка руководителям — как на сервере (_sa_sh_line); корешок «Билета» — день по частям", async () => {
    const S = await import("../lib/chat-smart.js");
    expect(S.shiftLogLine({ st: "done", mode: "give", date: "2026-10-30", label: "Вечер", fromName: "Вера Соколова", byName: "Пётр Орлов" }))
      .toBe("Передача смены пт 30, вечер: отдаёт Вера С., забирает Пётр О. · график обновлён");
    expect(S.shiftLogLine({ st: "done", mode: "swap", date: "2026-10-31", byDate: "2026-11-02", fromName: "Мария Ким", byName: "Роман" }))
      .toBe("Обмен сменами: Мария К. (сб 31) и Роман (пн 2) · график обновлён");
    expect(S.shiftLogLine({ st: "open" })).toBe("");
    expect(S.dayParts("2026-11-01")).toEqual({ wd: "вс", d: 1, mon: "ноя" });
    const sql = rd("supabase/supabase-stage38-chat.sql");
    expect(sql).toContain("then 'Обмен сменами: ' || _sa_chat_nm(p_card->>'fromName') || ' (' ||");
    expect(sql).toContain("': отдаёт ' || _sa_chat_nm(p_card->>'fromName') || ', забирает ' || _sa_chat_nm(p_card->>'byName') || ' · график обновлён' end");
  });
  it("задание, срок, опрос и голос, подсказки, Наставник, плитки «+»", async () => {
    const S = await import("../lib/chat-smart.js");
    expect([S.taskLine({ n: 3, of: 8 }), S.taskLine({ n: 1, of: 8 }), S.taskLine({ n: 8, of: 8 }), S.taskLine({})]).toEqual(["прошли 3 из 8", "прошёл 1 из 8", "прошли все 8", ""]);
    const now = new Date(2026, 9, 27, 12);
    expect([S.dueLine("2026-10-27", now), S.dueLine("2026-10-28", now), S.dueLine("2026-10-30", now), S.dueLine(null, now)]).toEqual(["до конца дня", "до завтра", "до пятницы, 30 октября", ""]);
    expect(S.dueChoices(now).map((x) => x[0] + ":" + (x[2] || "-"))).toEqual(["today:2026-10-27", "tomorrow:2026-10-28", "fri:2026-10-30", "week:2026-11-03", "none:-"]);
    const v = S.pollView({ opts: ["Я выйду", "Не смогу"], votes: [{ o: 0, emp: "a", name: "Анна Смирнова" }, { o: 0, emp: "p", name: "Пётр Орлов" }, { o: 1, emp: "i", name: "Илья" }] }, "a");
    expect([v.total, v.voted, v.opts[0].n, v.opts[0].pct, v.opts[0].mine, v.opts[0].names.join(",")]).toEqual([3, true, 2, 67, true, "Анна С.,Пётр О."]);
    const me = { id: "a", name: "Анна" };
    expect(S.withVote([{ o: 0, emp: "a" }], 1, me)).toEqual([{ o: 1, emp: "a", name: "Анна" }]);
    expect(S.withVote([{ o: 1, emp: "a" }], 1, me)).toEqual([]);
    expect([S.pollProblem("Ну", ["a", "b"]), S.pollProblem("Кто выйдет?", ["a"]), S.pollProblem("Кто выйдет?", ["Да", "да"]), S.pollProblem("Кто выйдет?", ["Да", "Нет"])])
      .toEqual(["Напиши вопрос", "Нужно хотя бы два варианта", "Варианты повторяются", ""]);
    expect([S.askAi("@Наставник какие аллергены?"), S.askAi("Наставник, подскажи"), S.askAi("@наставники привет"), S.askAi("наставник сказал")]).toEqual([true, true, false, false]);
    expect(S.aiQuestion("@Наставник, какие аллергены в борще?")).toBe("какие аллергены в борще?");
    expect(S.intents("Кто может подменить меня в субботу?", { lead: false }, "team")).toEqual(["give", "poll"]);
    expect(S.intents("Тартар закончился, убираем из меню", { lead: true }, "team")).toEqual(["stop"]);
    expect(S.intents("Тартар закончился", { lead: false }, "team")).toEqual([]);
    expect(S.actTiles({ lead: false }, { kind: "team" }).map((t) => t.id).filter((id) => id !== "late" && id !== "thx")).toEqual(["photo", "give", "swap", "share", "poll", "ai"]);   // v99: «Опаздываю» (tests/v99.test.js); v108: «Спасибо коллеге» (tests/v108.test.js)
    expect(S.actTiles({ lead: true }, { kind: "team" }).map((t) => t.id).filter((id) => id !== "late" && id !== "thx")).toEqual(["photo", "give", "swap", "task", "share", "poll", "stop", "brief", "ai"]);
    expect(S.actTiles({ lead: true }, { kind: "dm" }).map((t) => t.id)).toEqual(["photo", "give", "swap", "task", "share", "ai"]);
    expect(S.actTiles({ lead: true }, { kind: "net" }).map((t) => t.id)).toEqual(["photo", "task", "share", "poll", "ai"]);
  });
});

describe("v93: что чат знает о приложении (lib/chat-app.js)", () => {
  it("список: темы, уроки и тесты по ролям, свои курсы, блюда (картинка только https), коктейли, главы Справочника (руководителям — свои)", async () => {
    const A = await import("../lib/chat-app.js");
    const index = { bar: [{ id: "b0", title: "Новичок за баром", lessons: [{ id: "b0-1", title: "Лёд", type: "lesson" }] }],
      seasonal: [{ id: "s0", title: "Первый день", lessons: [{ id: "s0-1", title: "Нормально бояться", type: "lesson" }, { id: "s0-p", title: "Практика", type: "practice" }, { id: "s0-q", title: "Тест: первый день", type: "quiz" }] }] };
    const items = A.chatItems({ index, custom: [{ id: "c1", title: "Свой", lessons: [{ id: "c1-1", title: "Урок свой", type: "lesson" }] }],
      dishes: [{ id: 7, name: "Тартар", cat: "Закуски", ingredients: ["тунец", "авокадо"], img: "data:image/png;base64,AA" }, { id: 8, name: "Архив", archived: true }],
      cocktails: [{ id: "negroni", name: "Негрони", ing: [["джин"], ["кампари"]] }], refs: [{ id: "r1", title: "Встреча", course: "Сервис", type: "lesson" }, { id: "r2", title: "Для руководителей", type: "lesson", leaderOnly: true }],
      label: (r) => ({ seasonal: "Новичок", bar: "Бар" }[r] || r) });
    expect(items.map((x) => x.kind + ":" + x.id)).toEqual(["module:s0", "lesson:s0-1", "quiz:s0-q", "module:b0", "lesson:b0-1", "module:c1", "lesson:c1-1", "dish:7", "cocktail:negroni", "ref:r1"]);
    expect(items[0]).toMatchObject({ title: "Первый день", sub: "Новичок · 1 урок", lessons: ["s0-1"], quizzes: ["s0-q"] });
    expect(items.find((x) => x.kind === "dish")).toMatchObject({ title: "Тартар", sub: "Закуски · тунец, авокадо", img: "" });
    expect(A.searchItems(items, "тест", ["quiz", "lesson"]).map((x) => x.id)).toEqual(["s0-q"]);
    expect(A.searchItems(items, "нов", null).map((x) => x.id).slice(0, 2)).toEqual(["b0", "s0"]);
    expect(A.chatItems({ refs: [{ id: "r2", title: "Для руководителей", type: "lesson", leaderOnly: true }], leader: true }).length).toBe(1);
  });
  it("пройдено ли: урок, тест, тема (все уроки и тесты); ответ ИИ: метки — карточками, [[go:…]] — мимо; без меток — по названиям", async () => {
    const A = await import("../lib/chat-app.js");
    const p = { completed: { "s0-1": true }, quizDone: { "s0-q": true } };
    expect([A.itemDone({ kind: "lesson", id: "s0-1" }, p), A.itemDone({ kind: "quiz", id: "s0-q" }, p), A.itemDone({ kind: "module", lessons: ["s0-1"], quizzes: ["s0-q"] }, p),
      A.itemDone({ kind: "module", lessons: ["s0-1", "s0-2"], quizzes: [] }, p), A.itemDone({ kind: "dish", id: "1" }, p)]).toEqual([true, true, true, false, false]);
    const r = A.aiReply("Борщ: молоко и сельдерей. [[dish:d2|Карточка]] [[go:menu|Меню]] Повтори урок [[lesson:s3-3|Урок]].\n\n\n[[dish:нет]]",
      { dishes: [{ id: "d2", name: "Борщ с уткой", ingredients: ["утка"] }], lessons: { "s3-3": "Аллергены при приёме заказа" } });
    expect(r.text).toBe("Борщ: молоко и сельдерей. Повтори урок.");
    expect(r.cards.map((c) => c.kind + ":" + c.id + ":" + c.title)).toEqual(["dish:d2:Борщ с уткой", "lesson:s3-3:Аллергены при приёме заказа"]);
    expect(A.aiReply("Попробуй Кедровый негрони к стейку", { cocktails: [{ id: "c-n", name: "Кедровый негрони", ing: [] }] }).cards.map((c) => c.id)).toEqual(["c-n"]);
    expect(A.aiReply("**Коротко:** орехов нет, но **уточни** у шефа.").text).toBe("Коротко: орехов нет, но уточни у шефа.");   // разметки в переписке нет
  });
  it("брифинг дня карточкой: «Брифинг смены · 27 октября», строки (до 6 по 140 знаков); нет брифинга — null", async () => {
    const A = await import("../lib/chat-app.js");
    const data = { day: "2026-10-27", dayLabel: "27 октября", on: { roster: true, stop: true, res: true, note: true }, blocks: { roster: [{ name: "Вечер", people: ["Анна", "Пётр"] }],
      stop: ["Тартар"], res: [{ t: "19:00" }, { t: "20:00" }], note: "Банкет на веранде" } };
    expect(A.briefCard({ data })).toEqual({ date: "2026-10-27", title: "Брифинг смены · 27 октября", lines: ["Кто сегодня: Вечер Анна, Пётр", "Брони сегодня: 2", "Стоп-лист: Тартар", "Банкет на веранде"] });
    expect([A.briefCard(null), A.briefCard({ data }, "2026-10-28")]).toEqual([null, null]);
    const app = A.makeChatApp({ restaurant: "Нигде", leader: false, progress: () => p, brief: () => ({ data }), open: (x) => "открыл " + x.kind });
    const p = { completed: { "s0-1": true }, quizDone: {} };
    expect([app.done({ kind: "lesson", id: "s0-1" }), app.open({ kind: "dish" }), app.brief().lines.length]).toEqual([true, "открыл dish", 4]);
    expect(app.search("", ["quiz"]).every((x) => x.kind === "quiz")).toBe(true);
  });
});

describe("v93: вызовы сервера (lib/chat-api.js)", () => {
  it("смены, карточки, голос, «Напомнить», стоп-лист — в функции этапа 38", async () => {
    const { chatApi } = await import("../lib/chat-api.js");
    const seen = [];
    const api = chatApi((fn, args) => { seen.push([fn, args]); return Promise.resolve({ ok: true }); });
    await api.shiftsMine(); await api.shiftOffer(1, { date: "2026-10-30", mode: "swap", want: ["2026-11-02"], note: "Свадьба" }); await api.shiftTake(5);
    await api.shiftSwapOptions(5); await api.shiftSwap(5, "2026-11-02"); await api.shiftCancel(5);
    await api.cardSend(1, { t: "poll", q: "Кто?", opts: ["Я", "Не я"] }); await api.pollVote(9, 1); await api.taskRemind(9);
    await api.stopSet(1, { id: 7, name: "Тартар" }, true); await api.stopSet(1, { id: 7 }, false, null, 11);
    expect(seen).toEqual([["chat_shift_mine", {}], ["chat_shift_offer", { p_chat: 1, p_date: "2026-10-30", p_mode: "swap", p_want: ["2026-11-02"], p_note: "Свадьба" }],
      ["chat_shift_take", { p_msg: 5 }], ["chat_shift_options", { p_msg: 5 }], ["chat_shift_swap", { p_msg: 5, p_date: "2026-11-02" }], ["chat_shift_cancel", { p_msg: 5 }],
      ["chat_card_send", { p_chat: 1, p_card: { t: "poll", q: "Кто?", opts: ["Я", "Не я"] } }], ["chat_poll_vote", { p_msg: 9, p_o: 1 }], ["chat_task_remind", { p_msg: 9 }],
      ["chat_stop_set", { p_chat: 1, p_dish: "7", p_on: true, p_msg: null }], ["chat_stop_set", { p_chat: 1, p_dish: "7", p_on: false, p_msg: 11 }]]);
  });
  it("Наставник: сначала проверка (вопрос и лимит дня), потом ИИ приложения, потом ответ; лимит — ИИ не зовём", async () => {
    const { chatApi } = await import("../lib/chat-api.js");
    const seen = [], asked = [];
    const ai = (q) => { asked.push(q); return Promise.resolve({ text: "Молоко и сельдерей.", cards: [{ kind: "dish", id: "d2", title: "Борщ" }] }); };
    const api = chatApi((fn, args) => { seen.push([fn, args.p_body === null ? "проверка" : args.p_body]); return Promise.resolve({ ok: true, msg: { id: 1 } }); }, { ai });
    expect((await api.aiAsk(1, 50, "аллергены в борще?")).ok).toBe(true);
    expect([seen, asked]).toEqual([[["chat_ai_post", "проверка"], ["chat_ai_post", "Молоко и сельдерей."]], ["аллергены в борще?"]]);
    const lim = chatApi(() => Promise.resolve({ ok: false, error: "ai_limit" }), { ai: () => { throw new Error("не должен"); } });
    expect(await lim.aiAsk(1, 50, "?")).toEqual({ ok: false, error: "ai_limit" });
    const none = chatApi(() => Promise.resolve({ ok: true, check: true }));
    expect(await none.aiAsk(1, 50, "?")).toEqual({ ok: false, error: "no_ai" });
    const empty = chatApi(() => Promise.resolve({ ok: true }), { ai: () => Promise.resolve({ text: "", error: "limit" }) });
    expect(await empty.aiAsk(1, 50, "?")).toEqual({ ok: false, error: "limit" });
  });
});

describe("v93: стоп-лист из чата и меню, смены из чата и «Сохранить» в графике", () => {
  it("меню: стоп с сервера новее своего — в свои блюда; старее или такой же — своё; ничего не поменялось — тот же массив", async () => {
    const { mergeStops } = await import("../lib/menu-dishes.js");
    const own = [{ id: "d1", name: "Тартар", stop: null, stopAt: 100 }, { id: "d2", name: "Борщ", stop: { since: 50 }, stopAt: 300 }, { id: "d3", name: "Без отметки" }];
    const shared = [{ id: "d1", stop: { since: 200, by: "Мария Ким" }, stopAt: 200 }, { id: "d2", stop: null, stopAt: 250 }, { id: "d3", stop: { since: 10 }, stopAt: 10 }];
    const m = mergeStops(own, shared);
    expect(m.map((d) => d.id + ":" + (d.stop ? d.stop.since : "-") + ":" + (d.stopAt || 0))).toEqual(["d1:200:200", "d2:50:300", "d3:10:10"]);
    expect(mergeStops(own, [])).toBe(own);
    const src = rd("ui/menu-trainer.jsx");
    expect(src).toContain('const upd = { ...d, stop: stopped ? { since: Date.now() } : null, stopAt: Date.now() };');
    expect(src).toContain("const own = custom[restaurant] || [], nx = mergeStops(own, shared);");
  });
  it("график: своё — своё, нетронутое — как на сервере (обмен из чата не пропадает); замки так же; дни для строки", async () => {
    const { mergeCells, mergedDays } = await import("../lib/schedule-merge.js");
    const base = { s1: { 4: "В", 5: "В" }, s4: { 3: "Д" } };
    const mine = { s1: { 4: "В", 5: "У" }, s4: { 3: "Д" }, s9: {} };                       // руководитель поменял s1 5-е
    const theirs = { s1: { 5: "В" }, s4: { 3: "Д", 4: "В" } };                                // в чате: 4-е от Анны (s1) к Петру (s4)
    const r = mergeCells(base, mine, theirs);
    expect(r.cells).toEqual({ s1: { 5: "У" }, s4: { 3: "Д", 4: "В" }, s9: {} });
    expect([r.fromServer, mergedDays(r.fromServer)]).toEqual([[["s1", "4"], ["s4", "4"]], [4]]);
    const src = rd("ui/schedule.jsx");
    expect(src).toContain("const a = mergeCells(savedRef.current.plan || {}, plan, mm.payload.plan || {}), b = mergeCells(savedRef.current.locks || {}, locks, mm.payload.locks || {});");
    expect(src).toContain('setMsg(took.length ? "Сохранено вместе с обменами из чата (" + took.map(d => d + "-е").join(", ") + ")" : "Сохранено");');
    expect(src).toContain("savedRef.current = { plan: pl.plan || {}, locks: pl.locks || {}, days: pl.days || {}, facts: pl.facts || {} };");
  });
});

describe("v93: сервер (этап 38, статично; живые проверки — test38.sh)", () => {
  const sql = rd("supabase/supabase-stage38-chat.sql");
  it("карточки и ответы Наставника в сообщениях, голоса закрыты; в переписке — глазами того, кто смотрит", () => {
    expect(sql).toContain("alter table sa_chat_msgs add column if not exists card jsonb;");
    expect(sql).toContain("check (kind in ('text', 'call', 'photo', 'sys', 'card', 'ai'))");
    expect(sql).toContain("create table if not exists sa_chat_votes (");
    expect(sql).toContain("alter table sa_chat_votes enable row level security;");
    expect(sql).toContain("'card', case when m.kind in ('card', 'ai', 'sys') and not m.deleted then m.card end,");
    expect(fnBody(sql, "chat_open")).toContain("msgs := _sa_chat_smart(c, ch, msgs);");
    expect(sql).toContain("' функций из 35 · таблицы: '");   // v97: 35
    for (const f of ["chat_shift_mine", "chat_shift_offer", "chat_shift_take", "chat_shift_options", "chat_shift_swap", "chat_shift_cancel", "chat_card_send", "chat_task_remind", "chat_poll_vote", "chat_stop_set", "chat_ai_post"])
      expect([f, fnBody(sql, f).includes("language plpgsql volatile security definer set search_path to public")]).toEqual([f, true]);
    expect(sql).not.toMatch(/\{1,600\}/);   // в PostgreSQL повтор в регулярке — не больше 255
  });
  it("смены: та же должность, свободен, отпуск, отдых, подряд; без подтверждения — сразу в график с замком; руководители видят", () => {
    const why = fnBody(sql, "_sa_sh_why");
    for (const t of ["'в этот день уже есть смена'", "'в отпуске'", "'мало отдыха после смены накануне (нужно '", "'мало отдыха перед сменой назавтра (нужно '", "'вышло бы больше '"])
      expect([t, why.includes(t)]).toEqual([t, true]);
    expect(why).toContain("else 11 end;");
    expect(why).toContain("else 5 end;");
    expect(fnBody(sql, "_sa_sh_check")).toContain("else 'Забрать могут ' || _sa_chat_spos(gs->>'pos', true) || ', свободные в этот день' end);");
    expect(fnBody(sql, "_sa_sh_put")).toContain("jsonb_build_object(p_day, true)");
    // v97: «Забрать» общий для чата и «Графика» — _sa_sh_take_do
    expect(fnBody(sql, "chat_shift_take")).toContain("return _sa_sh_take_do(c, p_msg);");
    expect(fnBody(sql, "_sa_sh_take_do")).toContain("perform _sa_sh_done(ch, m, c);");
    expect(fnBody(sql, "_sa_sh_done")).toContain("values (lc.id, c->>'id', who, coalesce(c->>'restaurant', ''), line, 'sys', jsonb_build_object('t', 'log', 'mode', m.card->>'mode'));");
    expect(fnBody(sql, "_sa_sh_done")).toContain("and (coalesce(e.is_admin, false) or lower(coalesce(e.position, '')) = any(_sa_chat_lead_pos()))");
    expect(fnBody(sql, "chat_shift_offer")).toContain("if ch.id is null or ch.kind = 'net' or not _sa_chat_ok(c, ch) then");
  });
  it("задание, опрос, стоп-лист, Наставник: кто может и пределы", () => {
    const send = fnBody(sql, "chat_card_send");
    expect(send).toContain("it := _sa_chat_item(p_card->'item', array['lesson', 'quiz', 'module']);");
    expect(send).toContain("if char_length(q) < 3 or cardinality(opts) < 2 or cardinality(opts) > 6");
    expect(send).toContain("if ch.kind <> 'team' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;");
    expect(fnBody(sql, "chat_task_remind")).toContain("> now() - interval '3 hours' then return jsonb_build_object('ok', false, 'error', 'too_fast'); end if;");
    expect(fnBody(sql, "chat_stop_set")).toContain("dish || jsonb_build_object('stop', jsonb_build_object('since', ms, 'by', who), 'stopAt', ms)");
    const ai = fnBody(sql, "chat_ai_post");
    expect(ai).toContain("if used >= 30 then return jsonb_build_object('ok', false, 'error', 'ai_limit'); end if;");
    expect(ai).toContain("or q.created_at < now() - interval '10 minutes'");
    expect(ai).toContain("values (ch.id, 'ai', 'Наставник', rest, body, 'ai', q.id, jsonb_build_object('t', 'ai', 'cards', cards))");
  });
});

describe("v93: экран и приложение", () => {
  it("«Билет»: золотой корешок, перфорация и вырезы; закрытая — серый, стоп — красный; без эмодзи и «слово — слово» в текстах", () => {
    const src = rd("ui/chat-cards.jsx");
    expect(src).toContain(".ch-card-tile{display:flex;flex:0 0 74px;align-items:center;justify-content:center;border-right:2px dashed rgba(26,16,8,0.3);");
    expect(src).toContain('.ch-card::before,.ch-card::after{content:"";position:absolute;left:66px;width:16px;height:16px;border-radius:50%;background:var(--bg);');
    expect(src).toContain(".ch-card.done .ch-card-tile{background:linear-gradient(165deg,#9A907B,#776D59);color:#1E1A12}");
    expect(src).toContain(".ch-card.stopc .ch-card-tile{background:linear-gradient(165deg,#F09A8E,#B8352A);color:#fff;");
    expect(src).toContain("<NumTile ic={IC.poll} n={v.total} word={votesWord(v.total)} />");
    expect(src).toContain('cap={off ? "в меню" : "стоп"}');
    expect(src).not.toMatch(/cv-glass|cv-ticket|ch-v0/);
    for (const f of ["ui/chat-cards.jsx", "ui/chat.jsx", "ui/chat-kit.jsx", "lib/chat-smart.js", "lib/chat-app.js"]) {
      const c = code(rd(f));
      expect([f, EMOJI.test(c)]).toEqual([f, false]);
      expect([f, c.match(DASH)]).toEqual([f, null]);
    }
  });
  it("приложение: чат знает уроки и меню (контекст), открывает карточку на своём месте, Наставник — тем же ИИ", () => {
    const app = rd("App.jsx");
    expect(app).toContain("<ChatScreen a11y={a11y} me={chatMe} api={chatApiObj} stt={chatStt} appCtx={chatAppCtx}");
    expect(app).toContain('chatAiRef.current = (q) => import("./lib/chat-ai").then((m) => m.chatAi(q, profile, assistantLearner()));');
    expect(app).toContain('if (k === "lesson" || k === "quiz") { assistantNavigate({ lesson: id }, true); return; }');
    expect(app).toContain('if (k === "ref") { setRefStart(id); navigate("reference"); return; }');
    expect(rd("ui/chat.jsx")).toContain("const app = React.useMemo(() => app0 || (appCtx ? makeChatApp(appCtx) : null), [app0, appCtx]);");
    expect(rd("lib/chat-ai.js")).toContain('fetch(SUPABASE_URL + "/functions/v1/ai-chat"');
    expect(rd("tools/claude/chat-demo/build.mjs")).toContain('b.onResolve({ filter: /\\/chat-app$/ }, () => ({ path: join(HERE, "chat-app-stub.js") }));');
  });
  it("ошибки словами (с причиной от сервера), «Напомнить» — сколько и кому; справка про умный чат", async () => {
    const src = rd("ui/chat-cards.jsx");
    expect(src).toContain('if (e === "not_allowed") return (r.why ? String(r.why).replace(/\\.?$/, ".") : "Эту смену взять нельзя: другая должность или правила графика.");');
    expect(src).toContain('ai_limit: AI_NAME + " на сегодня ответил уже 30 раз. Завтра снова."');
    expect(rd("ui/chat.jsx")).toContain('flash(!n ? "Все уже прошли" : sent >= n ? "Напомнили: " + n : sent ? "Напомнили в Telegram: " + sent + " из " + n : "Telegram у них не подключён: напомни в чате");');
    const { GUIDE } = await import("../ui/guide.jsx");
    const g = GUIDE.flatMap((x) => x.items || []).find((x) => x.key === "chat") || {};
    expect(g.text).toContain("Напиши «@Наставник» и вопрос: он ответит прямо в переписке");
    expect(g.text).toContain("график меняется сразу у обоих, без подтверждения; руководители видят каждую передачу строкой в «Старших» и сообщением бота");
    expect(g.text.match(DASH)).toBe(null);
  });
  it("демо: смены живые (после обмена и «Забрать» — другие), Пётр забирает смену Веры, строки в «Старших»", async () => {
    const { demoApi } = await import("../tools/claude/chat-demo/demo-api.js");
    const api = demoApi();
    const team = await api.open("team");
    const giveM = team.msgs.find((m) => m.card && m.card.t === "shift" && m.card.note === "Семейный праздник");
    const before = (await api.shiftsMine()).shifts.length;
    expect((await api.shiftTake(giveM.id)).msg.card.st).toBe("done");
    expect((await api.shiftsMine()).shifts.length).toBe(before + 1);
    const leads = await api.open("leads");
    expect(leads.msgs.filter((m) => m.kind === "sys" && m.card && m.card.t === "log").map((m) => m.body)).toEqual([expect.stringMatching(/^Передача смены (пн|вт|ср|чт|пт|сб|вс) \d+, вечер: отдаёт Мария К\., забирает Роман · график обновлён$/)]);
    expect(rd("tools/claude/chat-demo/demo-api.js")).toContain("через 15 секунд в «Вся команда» Пётр забирает смену Веры");
  });
  it("после проверки вживую: «Кто не прошёл» не закрывается, когда карточка обновилась; «Открыть брифинг» открывает брифинг", () => {
    const chat = rd("ui/chat.jsx"), cards = rd("ui/chat-cards.jsx");
    expect(chat).toContain('if (a === "who") { setWhoOpen((s) => new Set(s).add(String(m.id))); return; }');
    expect(chat).toContain("showWho={whoOpen.has(String(m.id))}");
    expect(cards).toContain("export function CardMsg({ row, me, app, busy, hl, showWho = false, onAct, onMenu }) {");
    expect(cards).not.toContain("c.showWho");
    expect(rd("App.jsx")).toContain('if (k === "brief") { if (teamBrief) openTeamBrief(); else { navigate("shift"); briefAskRef.current.open = true; loadTeamBrief(true); } return; }');
  });
});

describe("v93: документы", () => {
  it("README: e2e-v93, test38 — 171 проверка; supabase/README — v93; CHANGES: Дополнение 406; «сборка v93»", () => {
    const readme = rd("tools/claude/README.md");
    expect(readme).toContain("`e2e-v93.mjs` — v93 (Доп. 406)");
    expect(readme).toMatch(/\((171 проверка|1[7-9]\d проверк[иа])\)/);
    expect(rd("supabase/README.md")).toContain("v93: перезапусти `supabase-stage38-chat.sql` ещё раз: чат станет «умным»");
    expect(rd("CHANGES.md")).toContain("# Дополнение 406 — Умный чат: смены, задания, опросы, стоп-лист и Наставник в переписке (v93)");
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(9[3-9]|\d{3,})<\/span>/);
  });
});
