// v106 (Доп. 419): «Утро руководителя». Владелец (29.10): «да, давай соберём» — про сводку руководителю каждое утро.
// Сервер — supabase/supabase-stage40-morning.sql (текст и кнопки сверены с lib/morning.js на настоящем Postgres:
// tools/claude/pg-check-stage40.mjs), экран — ui/morning.jsx, демо — tools/claude/demo-app. e2e — tools/claude/e2e-v106.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { morningModel, morningText, morningKb, dShort, dLong, hh, plural, joinAnd, nm, posAcc, daysText, upFirst, holesText, weekHoleDays, openLines, idleText,
  attnCount, MORNING_HOURS, MORNING_HOUR } from "../lib/morning.js";
import { STAGES, CRON_JOBS } from "../lib/server-check.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");
const B = { ok: true, day: "2026-10-29", rest: "Два моря, Океан", sched: true,
  shifts: [{ k: "Д", name: "День", from: 12, to: 20, people: [{ id: "u-maria", n: "Мария К.", late: null }, { id: "e-darya", n: "Дарья Л.", late: { min: 20, eta: "12:20" } }, { id: "e-anna", n: "Анна С.", late: null }] },
    { k: "В", name: "Вечер", from: 16, to: 24, people: [{ id: "e-petr", n: "Пётр О.", late: null }] }],
  count: 4, holes: [{ day: "2026-10-30", pos: "waiter", miss: 1 }, { day: "2026-10-31", pos: "waiter", miss: 1 }, { day: "2026-11-04", pos: "waiter", miss: 2 }, { day: "2026-11-04", pos: "bar", miss: 1 }],
  open: [{ id: 101, chat: 1, mode: "give", day: "2026-10-31", who: "Вера С.", pos: "waiter", n: 1 }, { id: 102, chat: 1, mode: "need", day: "2026-11-04", who: "Мария К.", pos: "waiter", n: 2 },
    { id: 103, chat: 1, mode: "swap", day: "2026-11-02", who: "Пётр О.", pos: "waiter", n: 1 }],
  stop: { n: 3, names: ["Закуска из морепродуктов", "Кальмар в азиатском стиле", "Салат с крабом и страчателлой"] },
  thanks: { n: 4, people: [{ id: "e-anna", n: "Анна С.", k: 2 }, { id: "e-vera", n: "Вера С.", k: 1 }, { id: "e-petr", n: "Пётр О.", k: 1 }], quote: "Анна подсказала с вином, всё было идеально", by: "Анна С." },
  ybrief: { reads: 2, of: 3 }, learn: { done: 2, of: 3 },
  idle: { list: [{ id: "e-darya", n: "Дарья Л.", days: null, tg: false }, { id: "e-petr", n: "Пётр О.", days: 9, tg: true }], more: 1 },
  brief: { done: false }, late: [{ id: "e-darya", n: "Дарья Л.", min: 20, eta: "12:20" }] };
// текст сверен с сервером (_sa_morning_text) на Postgres 16 — до символа
const TEXT = "<b>Доброе утро, Мария</b>\nЧетверг, 29 октября · Два моря, Океан\n\n<b>Сегодня в смене 4</b>\nДень 12:00–20:00: Мария К., Дарья Л., Анна С.\nВечер 16:00–24:00: Пётр О.\n" +
  "Опаздывает: Дарья Л., будет в 12:20\n\n<b>На неделе</b>\nпт 30: не хватает официанта\nсб 31: не хватает официанта\nср 4: не хватает 2 официантов и бармена\nОтдают смену: Вера С. (сб 31)\n" +
  "Ищут обмен: Пётр О. (пн 2)\nИщем в смену: 2 официантов на ср 4\n\n<b>Стоп-лист: 3</b>\nЗакуска из морепродуктов, Кальмар в азиатском стиле, Салат с крабом и страчателлой\n\n<b>Вчера</b>\n" +
  "Гости сказали спасибо 4 раза: Анна С. (2), Вера С., Пётр О.\n«Анна подсказала с вином, всё было идеально»\nБрифинг прочитали 2 из 3\nЗанимались 2 из 3, кто был в смене\n\n" +
  "<b>Давно не занимались</b>\nДарья Л. (ещё ни разу), Пётр О. (9 дней) и ещё 1\n\nБрифинг на сегодня ещё не собран";

describe("v106: слова сводки", () => {
  it("даты, часы, числа, имена, должности — как у сервера", () => {
    expect(dShort("2026-10-31")).toBe("сб 31");
    expect(dLong("2026-10-29")).toBe("четверг, 29 октября");
    expect(upFirst(dLong("2026-11-04"))).toBe("Среда, 4 ноября");
    expect([hh(10), hh(24), hh(2.5), hh(16.25)]).toEqual(["10:00", "24:00", "02:30", "16:15"]);
    expect([1, 2, 5, 11, 21, 22, 112].map((n) => plural(n, "день", "дня", "дней"))).toEqual(["день", "дня", "дней", "дней", "день", "дня", "дней"]);
    expect([joinAnd([]), joinAnd(["a"]), joinAnd(["a", "b"]), joinAnd(["a", "b", "c"])]).toEqual(["", "a", "a и b", "a, b и c"]);
    expect([nm("Анна Смирнова"), nm("Роман"), nm("  Пётр   Орлов ")]).toEqual(["Анна С.", "Роман", "Пётр О."]);
    expect([posAcc("waiter"), posAcc("waiter", 2), posAcc("host", 3), posAcc("bar"), posAcc("x")]).toEqual(["официанта", "2 официантов", "3 хостес", "бармена", "человека"]);
    expect(daysText(9)).toBe("9 дней");
    expect(MORNING_HOURS).toEqual([7, 8, 9, 10, 11, 12]);
    expect(MORNING_HOUR).toBe(9);
  });
  it("разбор ответа: мусор и старая версия сервера — пустые места, а не падение", () => {
    for (const raw of [null, 5, "x", [], {}, { holes: "x", open: [{ mode: "zzz" }], shifts: [{ people: "x" }], idle: 3, stop: { names: [1, null, "", "Борщ"] } }]) {
      const m = morningModel(raw);
      expect(Array.isArray(m.shifts) && Array.isArray(m.holes) && Array.isArray(m.open) && Array.isArray(m.idle.list) && Array.isArray(m.late)).toBe(true);
      expect(() => morningText(m, "Мария")).not.toThrow();
    }
    expect(morningModel({ stop: { n: 0, names: ["Борщ", ""] } }).stop).toEqual({ n: 1, names: ["Борщ"] });
  });
  it("строки недели, заявки, «давно не занимались», сколько дел ждёт", () => {
    const m = morningModel(B);
    expect(weekHoleDays(m)).toEqual(["2026-10-30", "2026-10-31", "2026-11-04"]);
    expect(holesText(m, "2026-11-04")).toBe("2 официантов и бармена");
    expect(holesText(m, m.day)).toBe("");
    expect(openLines(m)).toEqual(["Отдают смену: Вера С. (сб 31)", "Ищут обмен: Пётр О. (пн 2)", "Ищем в смену: 2 официантов на ср 4"]);
    expect(idleText(m.idle)).toBe("Дарья Л. (ещё ни разу), Пётр О. (9 дней) и ещё 1");
    expect(attnCount(m)).toBe(3 + 3 + 1);
  });
});

describe("v106: сообщение бота", () => {
  it("текст — как у сервера, до символа (HTML для Telegram)", () => {
    expect(morningText(B, "Мария")).toBe(TEXT);
    expect(morningText(morningModel(B), "Мария Ким")).toBe(TEXT);
  });
  it("пустой день — две строки; HTML в именах экранирован; «и ещё» у стоп-листа", () => {
    const empty = { ok: true, day: "2026-10-29", rest: "", sched: false, brief: { done: true } };
    expect(morningText(empty, "")).toBe("<b>Доброе утро</b>\nЧетверг, 29 октября");
    const t = morningText({ ...empty, rest: "Бар <&>", sched: true, count: 1, shifts: [{ k: "Д", name: "День", from: 12, to: 20, people: [{ n: "Анна <b>С." }] }],
      stop: { n: 9, names: ["A&B", "C", "D", "E", "F", "G", "H", "I"] } }, "Мария");
    expect(t).toContain("· Бар &lt;&amp;&gt;");
    expect(t).toContain("День 12:00–20:00: Анна &lt;b&gt;С.");
    expect(t).toContain("A&amp;B, C, D, E, F, G и ещё 3");
    expect(t).toContain("На неделе людей хватает");
  });
  it("кнопки: «Открыть утро»; «Собрать брифинг», если не собран; «График», если не хватает людей или есть заявки", () => {
    expect(morningKb(B)).toEqual([[{ text: "Открыть утро", go: "morning" }], [{ text: "Собрать брифинг", go: "briefing" }, { text: "График", go: "schedule" }]]);
    expect(morningKb({ ...B, holes: [], open: [], brief: { done: true } })).toEqual([[{ text: "Открыть утро", go: "morning" }]]);
  });
});

describe("v106: сервер (этап 40)", () => {
  const SQL = rd("supabase/supabase-stage40-morning.sql");
  it("функции приложения, права, расписание и настройки", () => {
    for (const f of ["morning_brief(p_token text)", "morning_set(p_token text, p_on boolean default null, p_hour int default null)", "morning_send_now(p_token text)", "morning_nudge(p_token text, p_emp text)"])
      expect(SQL).toContain("create or replace function " + f);
    expect(SQL).toContain("grant execute on function morning_brief(text), morning_set(text, boolean, int), morning_send_now(text), morning_nudge(text, text) to anon, authenticated;");
    expect(SQL).toContain("revoke all on function _sa_morning_at(text, timestamptz) from public, anon, authenticated;");
    expect(SQL).toContain("cron.schedule('sa-morning', '*/10 * * * *', 'select public.sa_morning_tick()')");
    expect(SQL).toContain("alter table sa_notify_prefs add column if not exists morning boolean not null default true;");
    expect(SQL).toContain("alter table sa_notify_prefs add column if not exists morning_hour smallint not null default 9;");
  });
  it("руководителю и только ему; час — с 6 до 12; окно — три часа после выбранного; одна сводка в день", () => {
    expect(SQL).toContain("if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");
    expect(SQL).toContain("if p_hour is not null and (p_hour < 6 or p_hour > 12) then return jsonb_build_object('ok', false, 'error', 'hour'); end if;");
    expect(SQL).toContain("if hr < e.hr or hr >= e.hr + 3 then continue; end if;");
    expect(SQL).toContain("if not _sa_tg_once(e.emp_id, ld, 'morning') then continue; end if;");
  });
  it("текст сервера — те же слова, что lib/morning.js", () => {
    for (const w of ["'<b>Доброе утро'", "'Не хватает: '", "'Опаздывает: '", "'Опаздывают: '", "', будет в '", "': не хватает '", "'Отдают смену: '", "'Ищут обмен: '", "'Ищем в смену: '",
      "'На неделе людей хватает'", "'<b>Стоп-лист: '", "' и ещё '", "'Гость сказал спасибо: '", "'Гости сказали спасибо '", "'Брифинг прочитали '", "', кто был в смене'",
      "'<b>Давно не занимались</b>'", "'ещё ни разу'", "'Брифинг на сегодня ещё не собран'", "'Открыть утро', 'morning'", "'Собрать брифинг', 'briefing'", "'График', 'schedule'"])
      expect(SQL, w).toContain(w);
  });
  it("«Сервер» в приложении знает этап 40 и расписание sa-morning", () => {
    expect(STAGES.find((s) => s.n === "40")).toEqual({ n: "40", file: "supabase-stage40-morning.sql", what: "Утро руководителя", fn: "morning_brief" });
    expect(CRON_JOBS.find((j) => j.name === "sa-morning")).toEqual({ name: "sa-morning", what: "Утро руководителя", n: "40" });
  });
});

describe("v106: приложение", () => {
  const APP = rd("App.jsx");
  it("экран, ссылки бота ?go=morning и ?go=briefing, пункт во вкладке «Смена» у руководителя", () => {
    expect(APP).toContain('const MorningScreen = lazyOf(() => import("./ui/morning"), "MorningScreen");');
    expect(APP).toContain('"seat", "chat", "schedule", "morning", "briefing"');   // v107: следом newbie и newbies
    expect(APP).toContain('else if (g === "morning") navigate("morning");');
    expect(APP).toContain('else if (g === "briefing") navigate("brief");');
    expect(APP).toContain('isLead && { key:"morning", group:"На смене", icon:"morning", label:"Утро руководителя",');
    expect(APP).toContain('else if (dest === "chat" && x && x.chat) setChatOpen({ intent: { kind: "chat", id: Number(x.chat), msg: x.msg ? Number(x.msg) : null, at: Date.now() } });');
    expect(rd("ui/home-hubs.jsx")).toContain("morning: (c) => <svg");
  });
  it("экран рисуется (до ответа сервера — «Собираю утро…»), назад — линза", async () => {
    const { MorningScreen } = await import("../ui/morning.jsx");
    const T = { screen: {}, lessHead: {}, backBtn2: {}, lessHeadTitle: {}, modCard: {}, para: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" } };
    const html = renderToString(React.createElement(MorningScreen, { T, a11y: false, profile: { name: "Мария" }, onBack: () => {} }));
    expect(html).toContain('data-morning="load"');
    expect(html).toContain("Собираю утро…");
    expect(html).toContain('data-lens="back"');
  });
});

describe("v106: демо-сервер — та же сводка", () => {
  const PEOPLE = [{ id: "u-m", name: "Мария", surname: "Ким", restaurant: "R", position: "manager" }, { id: "e-a", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter" }];
  const mk = () => makeServer({ today: "2026-10-29", rest: "R", people: PEOPLE, tok: { tm: "u-m", ta: "e-a" }, sstaff: [{ id: 1, name: "Ким Мария", pos: "manager" }, { id: 2, name: "Смирнова Анна", pos: "waiter" }],
    cfg: { shifts: [{ k: "Д", name: "День", from: 12, to: 20 }], need: { 1: { waiter: 2 }, 2: { waiter: 2 }, 3: { waiter: 2 } }, rules: { peakDows: [], highDows: [] }, staff: [] },
    plan: { 1: { 0: "Д" }, 2: { 0: "Д", 1: "Д" } }, menu: [{ id: "x", name: "Борщ", stop: { since: 1 } }, { id: "y", name: "Щи" }], tgLinked: ["u-m", "e-a"],
    thanks: [{ emp: "e-a", at: -1, text: "Очень внимательная официантка" }], learn: { "e-a": [-8] }, clock: () => Date.parse("2026-10-28T21:05:00Z") });
  it("руководителю — сводка: смена, нехватка, стоп-лист, «спасибо», давно не занимались; сотруднику — нельзя", () => {
    const s = mk(), r = s.rpc("morning_brief", { p_token: "tm" });
    expect(r.ok).toBe(true);
    expect(r.shifts).toEqual([{ k: "Д", name: "День", from: 12, to: 20, people: [{ id: "u-m", n: "Мария К.", late: null }, { id: "e-a", n: "Анна С.", late: null }] }]);
    expect(r.holes).toEqual([{ pos: "waiter", miss: 1, day: "2026-10-29" }, { pos: "waiter", miss: 1, day: "2026-10-30" }]);
    expect(r.stop).toEqual({ n: 1, names: ["Борщ"] });
    expect(r.thanks).toEqual({ n: 1, people: [{ id: "e-a", n: "Анна С.", k: 1 }], quote: "Очень внимательная официантка", by: "Анна С." });
    expect(r.idle).toEqual({ list: [{ id: "e-a", n: "Анна С.", days: 8, tg: true }], more: 0 });
    expect(r.prefs).toEqual({ on: true, hour: 9, linked: true, bot: true });
    expect(s.rpc("morning_brief", { p_token: "ta" }).error).toBe("forbidden");
  });
  it("настройки, «Прислать сейчас» (бот пишет руководителю), «Напомнить» (раз в день)", () => {
    const pings = [];
    const s = makeServer({ today: "2026-10-29", rest: "R", people: PEOPLE, tok: { tm: "u-m", ta: "e-a" }, sstaff: [], cfg: { shifts: [], staff: [] }, plan: {}, menu: [], tgLinked: ["u-m", "e-a"],
      ping: (...a) => pings.push(a) });
    expect(s.rpc("morning_set", { p_token: "tm", p_on: false, p_hour: 8 }).prefs).toEqual({ on: false, hour: 8, linked: true, bot: true });
    expect(s.rpc("morning_set", { p_token: "tm", p_hour: 13 }).error).toBe("hour");
    expect(s.rpc("morning_send_now", { p_token: "tm" }).ok).toBe(true);
    expect(s.rpc("morning_send_now", { p_token: "tm" }).error).toBe("too_fast");
    expect(pings[0][0]).toBe("u-m");
    expect(pings[0][1]).toMatch(/^<b>Доброе утро, Мария<\/b>/);
    expect(pings[0][5].kind).toBe("morning");
    expect(s.rpc("morning_nudge", { p_token: "tm", p_emp: "e-a" }).ok).toBe(true);
    expect(s.rpc("morning_nudge", { p_token: "tm", p_emp: "e-a" }).error).toBe("already");
    expect(pings[1][0]).toBe("e-a");
    expect(pings[1][1]).toBe("Мария К. напоминает про разминку: 2 минуты, три ситуации из зала.");
  });
});
