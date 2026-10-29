// v107 (Доп. 420): новичок — старт с собеседования, тёплый вход, наставник из команды. Владелец (29.10): «Вот эти» — из
// списка идей: темы, которые кандидат провалил на собеседовании, — первыми в «Первой неделе»; бот накануне первой смены
// (куда, к какому времени, к кому, что надеть); «Знакомьтесь» и «вышла на самостоятельную смену» в «Вся команда»; опытный
// ведёт новичка и получает отметку. Сервер — supabase/supabase-stage41-newbie.sql (тексты бота сверены с lib/newbie.js на
// Postgres: tools/claude/sql/test41.sh), экраны — ui/newbie.jsx, карточки — ui/chat-cards.jsx, демо — tools/claude/demo-app.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import {
  NB_PLAN, NB_STEP_IDS, NB_BUDDY_STEPS, NB_SOLO, NB_FOCUS_MAX, NB_WEAK, NB_ARRIVE, NB_ARRIVE0, NB_COMP_MODULES, posWord, dayDiff, memoOf, arriveAt, shiftLabel, whenWord,
  withUs, newbieModel, focusModule, focusSteps, planOf, doneCount, totalCount, firstLine, focusLine, eveText, eveBuddyText, eveKb, eveBuddyKb, helloView, soloView,
  newbieCardSum, focusFromPayload, mentorLine, soloDays,
} from "../lib/newbie.js";
import { cardSummary } from "../lib/chat-smart.js";
import { STAGES, CRON_JOBS } from "../lib/server-check.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");
const FIRST = { day: "2026-10-30", k: "Д", name: "День", from: 12, to: 20 };
const MEMO = { addr: "Служебный вход со двора, звонок справа", arrive: 15, dress: "Чёрный верх, тёмные брюки", meet: "", extra: "Обед для команды в 15:30" };
const NB = { newbie: true, emp: "e-k", name: "Ксения Миронова", pos: "waiter", rest: "Два моря, Океан", day: "2026-10-29", started: "2026-10-28", days: 1, first: FIRST, memo: MEMO,
  buddy: { id: "e-a", name: "Анна Смирнова", pos: "waiter" }, focus: [{ topic: "Конфликты и сложные ситуации" }, { topic: "Честность и деньги" }],
  checked: { d1c: "2026-10-28T10:00:00Z" }, confirm: { d2c: { by: "e-a", name: "Анна Смирнова", at: "2026-10-29T15:00:00Z" } } };
// тексты бота — те же, что у сервера (_sa_nb_eve_text, _sa_nb_buddy_text): сверено на Postgres 16 в tools/claude/sql/test41.sh
const EVE = "<b>Завтра твоя первая смена</b>\nПятница, 30 октября · День 12:00–20:00\nДва моря, Океан\n\nПриходи к 11:45\nКак найти: Служебный вход со двора, звонок справа\n" +
  "Форма: Чёрный верх, тёмные брюки\nТебя встретит Анна С., твой наставник\nОбед для команды в 15:30\n\nВ «Первой неделе» план и с чего начать.";
const EVE_BUDDY = "<b>Завтра первая смена у новичка</b>\nКсения М., официант · День 12:00–20:00\nТы наставник: встреть к 11:45 и покажи, где что.";

describe("v107: слова и план новичка", () => {
  it("план недели — прежние шаги и id; подтверждает наставник — «5 столов» и самостоятельная смена", () => {
    expect(NB_PLAN.map((p) => p.day)).toEqual(["ДЕНЬ 1", "ДНИ 2–3", "К КОНЦУ НЕДЕЛИ"]);
    expect(NB_STEP_IDS).toEqual(["d1a", "d1b", "d1c", "d1d", "d2a", "d2b", "d2c", "d2d", "d3a", "d3b"]);
    expect(NB_BUDDY_STEPS).toEqual(["d2c", "d3b"]);
    expect(NB_SOLO).toBe("d3b");
    // тот же план, что был в «Первой неделе» (ui/screens-admin.jsx)
    const old = rd("ui/screens-admin.jsx");
    for (const p of NB_PLAN) for (const s of p.steps) expect(old).toContain('{ id:"' + s.id + '", text:"' + s.text + '" }');
  });
  it("памятка: пустое — пусто, приходить за 15 минут; к какому времени; смена словами; когда", () => {
    expect(memoOf(null)).toEqual({ addr: "", arrive: 15, dress: "", meet: "", extra: "" });
    expect(memoOf({ arrive: 30, addr: "  вход  со двора ", meet: "x".repeat(150) })).toEqual({ addr: "вход со двора", arrive: 30, dress: "", meet: "x".repeat(100), extra: "" });
    expect(memoOf({ arrive: 7 }).arrive).toBe(NB_ARRIVE0);
    expect(NB_ARRIVE).toEqual([0, 10, 15, 20, 30]);
    expect([arriveAt(12, 15), arriveAt(16, 0), arriveAt(10, 30), arriveAt(12, 10)]).toEqual(["11:45", "16:00", "09:30", "11:50"]);
    expect(shiftLabel(FIRST)).toBe("День 12:00–20:00");
    expect([whenWord("2026-10-29", "2026-10-29"), whenWord("2026-10-30", "2026-10-29"), whenWord("2026-10-31", "2026-10-29"), whenWord("2026-11-02", "2026-10-29")])
      .toEqual(["сегодня", "завтра", "послезавтра", "пн 2"]);
    expect([withUs(0), withUs(1), withUs(3), withUs(6)]).toEqual(["первый день", "1 день", "3 дня", "6 дней"]);
    expect(dayDiff("2026-10-29", "2026-11-02")).toBe(4);
    expect([posWord("waiter"), posWord("hostess"), posWord("senior_bartender"), posWord("x")]).toEqual(["официант", "хостес", "старший бармен", ""]);
  });
  it("ответ сервера: мусор и старая версия — пустые места, а не падение", () => {
    const m = newbieModel({ newbie: true, first: { day: "вчера" }, focus: "x", checked: { d1a: "t", bad: "t", "f:Тема": "t" }, confirm: { d1a: { by: 1 }, d2c: "x", d3b: { by: "e", name: "Анна", at: "a" } },
      buddy: { id: null }, hello: { msg: "x" }, solo: {}, buddy_of: [{ emp: 1, name: "Пётр Орлов" }, { name: "" }] });
    expect(m.first).toBe(null);
    expect(m.focus).toEqual([]);
    expect(m.checked).toEqual({ d1a: "t", "f:Тема": "t" });
    expect(m.confirm).toEqual({ d3b: { by: "e", name: "Анна", at: "a" } });
    expect([m.buddy, m.hello, m.solo]).toEqual([null, null, null]);
    expect(m.buddyOf).toEqual([{ emp: "1", name: "Пётр Орлов" }]);
    expect(newbieModel({ newbie: false }).newbie).toBe(false);
    expect(newbieModel(null).memo).toEqual({ addr: "", arrive: 15, dress: "", meet: "", extra: "" });
  });
  it("темы собеседования: AI — баллы ниже 70, обычный тест — меньше 70% верных; слабые первыми, не больше трёх", () => {
    expect(NB_WEAK).toBe(70); expect(NB_FOCUS_MAX).toBe(3);
    expect(focusFromPayload({ aiScores: { "Сервис и гость": 78, "Конфликты и сложные ситуации": 45, "Приоритеты и организация": 70, "Честность и деньги": 62, "Команда": 85 } }))
      .toEqual([{ topic: "Конфликты и сложные ситуации", score: 45 }, { topic: "Честность и деньги", score: 62 }]);
    expect(focusFromPayload({ topics: [{ topic: "Сервис и гость", ok: 2, n: 3 }, { topic: "Команда", ok: 0, n: 2 }, { topic: "Гигиена и безопасность", ok: 1, n: 1 },
      { topic: "Честность и деньги", ok: 1.5, n: 3 }, { topic: "Приоритеты и организация", ok: 1, n: 2 }, { topic: "x", ok: 1, n: 0 }] }))
      .toEqual([{ topic: "Команда", score: 0 }, { topic: "Приоритеты и организация", score: 50 }, { topic: "Честность и деньги", score: 50 }]);
    expect(focusFromPayload({ aiScores: {}, topics: [{ topic: "Команда", ok: 0, n: 1 }] })).toEqual([]);   // AI-интервью без баллов — тем нет
    expect(focusFromPayload(null)).toEqual([]);
  });
  it("тема собеседования → тема трека; нет такой — «разбери с наставником»; «Свой раздел» — урок заведения", () => {
    const mods = [{ id: "s4", tag: "Урок 6", title: "Работа с жалобами", lessons: [{ id: "a", type: "lesson" }, { id: "q", type: "quiz" }] }, { id: "c1", title: "Регламент веранды", lessons: [] }];
    expect(focusModule("Конфликты и сложные ситуации", "seasonal", mods).id).toBe("s4");
    expect(focusModule("Честность и деньги", "seasonal", mods)).toBe(null);
    expect(focusModule("Свой раздел: регламент веранды", "seasonal", mods).id).toBe("c1");
    for (const [tr, map] of Object.entries(NB_COMP_MODULES)) expect(Object.keys(map).length, tr).toBeGreaterThan(4);
    expect(NB_COMP_MODULES.seasonal["Конфликты и сложные ситуации"]).toBe("s4");
    expect(NB_COMP_MODULES.bar["Продукт и подача"]).toBe("bar3");
    expect(NB_COMP_MODULES.spg["Конфликты и сложные ситуации"]).toBe("spg-m6");
    const fs = focusSteps(newbieModel(NB), { track: "seasonal", modules: mods, completed: { a: true }, quizDone: { q: true } });
    expect(fs.map((s) => [s.id, s.sub, s.module, s.done, s.auto])).toEqual([
      ["f:Конфликты и сложные ситуации", "Урок 6 · «Работа с жалобами»", "s4", true, true],
      ["f:Честность и деньги", "Разбери с наставником на смене", null, false, false]]);
  });
  it("план: «С собеседования» первыми, дальше дни; шаги наставника — по подтверждению; сделано и всего", () => {
    const nb = newbieModel(NB), p = planOf(nb, { track: "seasonal", modules: [] });
    expect(p.sections.map((s) => s.key)).toEqual(["focus", "d1", "d2", "d3"]);
    expect(p.sections[0].title).toBe("С СОБЕСЕДОВАНИЯ");
    expect(p.total).toBe(12);
    expect(p.done).toBe(2);   // «Внешний вид» отмечен сам, «5 столов» подтвердила наставник
    const d2c = p.sections[2].steps.find((s) => s.id === "d2c");
    expect([d2c.buddy, d2c.done, d2c.conf.name]).toEqual([true, true, "Анна Смирнова"]);
    expect(planOf(newbieModel({ ...NB, checked: { d2c: "x", d3b: "x" }, confirm: {} })).done).toBe(0);   // сам себе наставник не подтвердит
    expect(planOf(newbieModel({ ...NB, focus: [] })).sections.map((s) => s.key)).toEqual(["d1", "d2", "d3"]);
    expect([doneCount(nb), totalCount(nb)]).toEqual([2, 12]);
  });
  it("первая смена словами; темы строкой для руководителя", () => {
    expect(firstLine(newbieModel(NB))).toBe("Первая смена: завтра, 12:00");
    expect(firstLine(newbieModel({ ...NB, day: "2026-11-02" }))).toBe("Первая смена была 30 октября");
    expect(firstLine(newbieModel({ ...NB, first: null }))).toBe("В графике смен пока нет");
    expect(focusLine([{ topic: "Конфликты и сложные ситуации", score: 45 }, { topic: "Свой раздел: Веранда", score: 50 }])).toBe("конфликты и сложные ситуации 45, веранда 50");
    expect(focusLine([{ topic: "Честность и деньги", score: 62 }], false)).toBe("честность и деньги");
    expect(soloDays("2026-10-30", "2026-11-04")).toBe(5);
  });
});

describe("v107: бот и карточки", () => {
  it("накануне первой смены: новичку и наставнику — как у сервера, до символа (HTML для Telegram)", () => {
    expect(eveText(NB)).toBe(EVE);
    expect(eveBuddyText(NB)).toBe(EVE_BUDDY);
    expect(eveText({ ...NB, buddy: null, memo: { meet: "менеджер Мария" } })).toContain("Тебя встретит: менеджер Мария\n");
    expect(eveText({ ...NB, buddy: null, memo: {} }).split("\n")).toEqual(["<b>Завтра твоя первая смена</b>", "Пятница, 30 октября · День 12:00–20:00", "Два моря, Океан", "",
      "Приходи к 11:45", "Тебя встретит менеджер смены", "", "В «Первой неделе» план и с чего начать."]);
    expect(eveText({ ...NB, rest: "Бар <&>", memo: { addr: "<b>двор</b>" } })).toContain("Бар &lt;&amp;&gt;\n\nПриходи к 11:45\nКак найти: &lt;b&gt;двор&lt;/b&gt;");
    expect(eveText({ ...NB, first: null })).toBe("");
    expect(eveKb()).toEqual([[{ text: "Первая неделя", go: "newbie" }]]);
    expect(eveBuddyKb()).toEqual([[{ text: "Новички", go: "newbies" }]]);
  });
  it("«Знакомьтесь»: кто, первая смена, наставник; поздороваться — раз; сам новичок — видит, кто поздоровался", () => {
    const c = { t: "hello", emp: "e-k", name: "Ксения Миронова", pos: "waiter", first: { day: "2026-10-30", from: 12, name: "День" }, buddy: { id: "e-a", name: "Анна Смирнова" },
      greet: [{ id: "e-p", n: "Пётр Орлов" }] };
    const v = helloView(c, { id: "e-v" });
    expect([v.title, v.sub, v.line, v.act, v.btn]).toEqual(["Знакомьтесь: Ксения Миронова", "Официант · первая смена: пт 30, 12:00 · наставник Анна С.", "Поздоровались: Пётр О.", "greet", "Поздороваться"]);
    expect(helloView(c, { id: "e-p" }).act).toBe(null);
    expect(helloView(c, { id: "e-p" }).line).toBe("Поздоровались: ты");
    expect([helloView(c, { id: "e-k" }).act, helloView(c, { id: "e-k" }).line]).toEqual([null, "С тобой поздоровались: Пётр О."]);
    expect(helloView({ ...c, greet: [] }, { id: "e-k" }).line).toBe("Тебя представили команде");
  });
  it("«Первая самостоятельная смена»: глагол по имени, за сколько дней, наставник; поздравить — раз", () => {
    const c = { t: "solo", emp: "e-t", name: "Тимур Ахметов", pos: "bartender", days: 5, buddy: { id: "e-i", name: "Илья Белов" }, greet: [] };
    const v = soloView(c, { id: "e-v" });
    expect([v.title, v.sub, v.line, v.act, v.btn]).toEqual(["Тимур вышел на самостоятельную смену", "наставник Илья Б. · 5 дней с первой смены", "Пока никто не поздравил", "greet", "Поздравить"]);
    expect(soloView({ ...c, name: "Ксения Миронова", emp: "e-k" }, { id: "e-k" }).title).toBe("Ты вышла на самостоятельную смену");
    expect(soloView({ ...c, days: 0, greet: [{ id: "e-v", n: "Вера Соколова" }] }, { id: "e-v" }).sub).toBe("наставник Илья Б.");
    expect(soloView({ ...c, greet: [{ id: "e-v", n: "Вера Соколова" }] }, { id: "e-v" }).act).toBe(null);
  });
  it("коротко о карточках — в списке чатов, как у сервера; «Наставник новичков» в карточке коллеги", () => {
    expect(newbieCardSum({ t: "hello", name: "Ксения Миронова", pos: "waiter" })).toBe("Знакомьтесь: Ксения Миронова, официант");
    expect(newbieCardSum({ t: "solo", name: "Ксения Миронова" })).toBe("Первая самостоятельная смена: Ксения Миронова");
    expect(cardSummary({ t: "hello", name: "Тимур Ахметов", pos: "bartender" })).toBe("Знакомьтесь: Тимур Ахметов, бармен");
    expect(mentorLine({ now: [{ name: "Ксения Миронова" }], led: [{ name: "Тимур Ахметов", solo: "2026-10-29" }] }))
      .toBe("Наставник новичков · ведёт: Ксения М. · вышли на самостоятельную смену: Тимур А.");
    expect(mentorLine({ now: [], led: [] })).toBe("");
  });
});

describe("v107: сервер (этап 41)", () => {
  const SQL = rd("supabase/supabase-stage41-newbie.sql");
  it("функции приложения, права, расписание, новый сотрудник — сам в «Новичках»", () => {
    for (const f of ["newbie_me(p_token text)", "newbie_check(p_token text, p_steps text[], p_on boolean)", "newbie_list(p_token text)",
      "newbie_set(p_token text, p_emp text, p_buddy text default null, p_cand bigint default null, p_hello boolean default null)", "newbie_confirm(p_token text, p_emp text, p_step text, p_on boolean)",
      "newbie_memo_set(p_token text, p_memo jsonb)", "newbie_add(p_token text, p_emp text, p_on boolean)", "chat_greet(p_token text, p_msg bigint)", "chat_newbie_mark(p_token text, p_emp text)"])
      expect(SQL).toContain("create or replace function " + f);
    expect(SQL).toContain("chat_newbie_mark(text, text) to anon, authenticated;");
    expect(SQL).toContain("revoke all on function _sa_nb_due(boolean, timestamptz) from public, anon, authenticated;");
    expect(SQL).toContain("cron.schedule('sa-newbie', '*/10 * * * *', 'select public.sa_newbie_tick()')");
    expect(SQL).toContain("create trigger sa_newbie_on_emp after insert on employees for each row execute function _sa_nb_on_emp();");
    expect(SQL).toContain("exception when others then null;");   // ошибка в триггере не мешает завести сотрудника
    expect(SQL).toContain("Сначала этап 38 (supabase-stage38-chat.sql)");
  });
  it("кто что может: свои шаги — сам (кроме шагов наставника), подтверждает наставник или руководитель, назначает — руководитель", () => {
    expect(SQL).toContain("s = any (array['d1a', 'd1b', 'd1c', 'd1d', 'd2a', 'd2b', 'd2d', 'd3a'])");
    expect(SQL).toContain("if coalesce(p_step, '') not in ('d2c', 'd3b') then return jsonb_build_object('ok', false, 'error', 'bad_step'); end if;");
    expect(SQL).toContain("and (coalesce((c->>'lead')::boolean, false) or nb.buddy_id = c->>'id')");
    expect(SQL).toContain("if m.card->>'emp' = c->>'id' then return jsonb_build_object('ok', false, 'error', 'self'");
    expect(SQL).toContain("continue when extract(hour from lnow) < 19 or extract(hour from lnow) >= 23;");
    expect(SQL).toContain("continue when not _sa_tg_once(e.id, today, 'newbie_eve');");
    expect(SQL).toContain("a.s < 70 order by a.s, a.t collate \"C\" limit 3");
  });
  it("тексты сервера — те же слова, что lib/newbie.js", () => {
    for (const w of ["'<b>Завтра твоя первая смена</b>'", "'Приходи к '", "'Как найти: '", "'Форма: '", "', твой наставник'", "'Тебя встретит: '", "'Тебя встретит менеджер смены'",
      "'В «Первой неделе» план и с чего начать.'", "'<b>Завтра первая смена у новичка</b>'", "'Ты наставник: встреть к '", "' и покажи, где что.'", "'Знакомьтесь: '",
      "'Первая самостоятельная смена: '", "'Первая неделя', 'newbie'", "'Новички', 'newbies'"])
      expect(SQL, w).toContain(w);
    for (const [k, w] of Object.entries({ waiter: "официант", hostess: "хостес", bartender: "бармен", senior_bartender: "старший бармен" })) expect(SQL).toContain("'" + k + "' then '" + w + "'");
  });
  it("«Сервер» в приложении знает этап 41 и расписание sa-newbie", () => {
    expect(STAGES.find((s) => s.n === "41")).toEqual({ n: "41", file: "supabase-stage41-newbie.sql", what: "Новичок: наставник, памятка, первая смена", fn: "newbie_me" });
    expect(CRON_JOBS.find((j) => j.name === "sa-newbie")).toEqual({ name: "sa-newbie", what: "Новичку накануне первой смены", n: "41" });
  });
});

describe("v107: приложение", () => {
  const APP = rd("App.jsx");
  it("экраны, ссылки бота ?go=newbie и ?go=newbies, пункты: новичку — первым в «Смене», руководителю и наставнику — «Новички»", () => {
    expect(APP).toContain('const NewbieScreen = lazyOf(loadNewbie, "NewbieScreen");');
    expect(APP).toContain('const NewbiesScreen = lazyOf(loadNewbie, "NewbiesScreen");');
    expect(APP).toContain('"morning", "briefing", "newbie", "newbies"].includes(v)');
    expect(APP).toContain('else if (g === "newbie") navigate("newbie");');
    expect(APP).toContain('else if (g === "newbies") navigate("newbies");');
    const shift = APP.indexOf('nbOn && nbInfo.newbie && { key:"ob", group:"Первая неделя"'), morning = APP.indexOf('isLead && { key:"morning"');
    expect(shift).toBeGreaterThan(0);
    expect(shift).toBeLessThan(morning);
    expect(APP).toContain('(nbOn ? staff || nbInfo.buddyOf.length > 0 : nbInfo && nbInfo.off ? role !== "seasonal" : staff) && { key:"ob", group:"Команда"');
    expect(APP).toContain('onDm={(x) => setChatOpen({ intent: { kind: "dm", emp: x.id, at: Date.now() } })}');
    expect(APP).toContain('onLegacy={() => navigate("onboarding")}');
  });
  it("экраны рисуются (до ответа сервера), назад — линза", async () => {
    const { NewbieScreen, NewbiesScreen } = await import("../ui/newbie.jsx");
    const T = { screen: {}, lessHead: {}, backBtn2: {}, lessHeadTitle: {}, modCard: {}, para: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" } };
    const a = renderToString(React.createElement(NewbieScreen, { T, a11y: false, profile: { name: "Ксения" }, onBack: () => {} }));
    expect(a).toContain('data-newbie="load"'); expect(a).toContain("Первая неделя"); expect(a).toContain('data-lens="back"');
    const b = renderToString(React.createElement(NewbiesScreen, { T, a11y: true, profile: { name: "Мария" }, onBack: () => {} }));
    expect(b).toContain('data-newbies="load"'); expect(b).toContain("Новички");
    // наставнику «Встретить к …» — только пока первая смена впереди; кнопка подтверждения — без смеси border и borderColor
    const NB = rd("ui/newbie.jsx");
    expect(NB).toContain('{!lead && n.first && dayDiff(n.day, n.first.day) >= 0 ? line("arrive", "", "Встретить к "');
    expect(NB).not.toContain("borderColor");
  });
  it("карточки в чате: «Знакомьтесь» с «Поздороваться», «самостоятельная смена» с днями; «Наставник новичков» у коллеги", async () => {
    const { CardMsg } = await import("../ui/chat-cards.jsx");
    const row = (card) => ({ m: { id: 7, emp: "u-m", name: "Мария Ким", at: "2026-10-28T18:40:00", kind: "card", card } });
    const h = renderToString(React.createElement(CardMsg, { row: row({ t: "hello", emp: "e-k", name: "Ксения Миронова", pos: "waiter", greet: [] }), me: { id: "e-v" }, onAct: () => {}, onMenu: () => {} }));
    expect(h).toContain('data-chat-card="hello"'); expect(h).toContain("Ксения Миронова"); expect(h).toContain('data-chat-greet="7"'); expect(h).toContain("Поздороваться");
    const s = renderToString(React.createElement(CardMsg, { row: row({ t: "solo", emp: "e-k", name: "Ксения Миронова", pos: "waiter", days: 6, greet: [] }), me: { id: "e-k" }, onAct: () => {}, onMenu: () => {} }));
    expect(s).toContain("Ты вышла на самостоятельную смену"); expect(s).not.toContain('data-chat-greet="');
    const CH = rd("ui/chat.jsx");
    expect(CH).toContain('if (a === "greet" && api.greet) {');
    expect(CH).toContain('{mark ? <div className="ch-pp-sh" data-chat-person-mentor="">{IC.star}<span>{mark}</span></div> : null}');
    expect(rd("lib/chat-api.js")).toContain('greet: (msg) => call("chat_greet", { p_msg: msg }),');
  });
});

describe("v107: демо-сервер — то же, что этап 41", () => {
  const P = [{ id: "u-m", name: "Мария", surname: "Ким", restaurant: "R", position: "manager" }, { id: "e-a", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter" },
    { id: "e-k", name: "Ксения", surname: "Миронова", restaurant: "R", position: "waiter" }, { id: "e-v", name: "Вера", surname: "Соколова", restaurant: "R", position: "waiter" }];
  const TOK = { tm: "u-m", ta: "e-a", tk: "e-k", tv: "e-v" };
  const mk = () => makeServer({ today: "2026-10-29", rest: "R", people: P, tok: TOK,
    sstaff: [{ id: 1, name: "Ким Мария", pos: "manager" }, { id: 2, name: "Смирнова Анна", pos: "waiter" }, { id: 3, name: "Миронова Ксения", pos: "waiter" }],
    cfg: { shifts: [{ k: "Д", name: "День", from: 12, to: 20 }], staff: [] }, plan: { 3: { 1: "Д", 2: "Д" } }, menu: [], tgLinked: ["e-k"],
    newbies: [{ emp: "e-k", started: -1, checked: ["d1c"] }], nbMemo: { addr: "Со двора", arrive: 20 },
    cands: [{ id: 9, name: "Ксения Миронова", at: -5, decision: "hire", aiScores: { "Конфликты и сложные ситуации": 45, "Команда": 90 } }] });
  it("новичку — его неделя: первая смена по графику, памятка, темы с собеседования (без баллов); остальным — не новичок", () => {
    const s = mk(), r = s.rpc("newbie_me", { p_token: "tk" });
    expect([r.ok, r.newbie, r.started, r.days]).toEqual([true, true, "2026-10-28", 1]);
    expect(r.first).toEqual({ day: "2026-10-30", k: "Д", name: "День", from: 12, to: 20 });
    expect(r.memo).toEqual({ addr: "Со двора", arrive: 20, dress: "", meet: "", extra: "" });
    expect(r.focus).toEqual([{ topic: "Конфликты и сложные ситуации" }]);
    expect(eveText(r).split("\n")[4]).toBe("Приходи к 11:40");
    expect(s.rpc("newbie_me", { p_token: "ta" })).toEqual({ ok: true, newbie: false, lead: false, buddy_of: [], day: "2026-10-29" });
    expect(s.rpc("newbie_me", { p_token: "x" }).error).toBe("auth");
  });
  it("руководитель: собеседование находится само (с баллами), наставник и «Знакомьтесь»; наставник видит своих", () => {
    const s = mk(), l = s.rpc("newbie_list", { p_token: "tm" });
    expect(l.lead).toBe(true);
    expect(l.list[0].cand).toEqual({ id: 9, name: "Ксения Миронова", date: "2026-10-24", how: "auto" });
    expect(l.list[0].focus).toEqual([{ topic: "Конфликты и сложные ситуации", score: 45 }]);
    expect(l.team.map((x) => x.id)).toEqual(["e-v", "e-a", "u-m"].sort((a, b) => (P.find((p) => p.id === a).name + P.find((p) => p.id === a).surname).localeCompare(P.find((p) => p.id === b).name + P.find((p) => p.id === b).surname, "ru")));
    expect(s.rpc("newbie_set", { p_token: "tm", p_emp: "e-k", p_buddy: "e-k" }).error).toBe("bad_buddy");
    const r = s.rpc("newbie_set", { p_token: "tm", p_emp: "e-k", p_buddy: "e-a", p_hello: true });
    expect([r.ok, r.item.buddy.name, r.msg.card.t, r.msg.card.buddy.name]).toEqual([true, "Анна Смирнова", "hello", "Анна Смирнова"]);
    expect(s.rpc("newbie_set", { p_token: "ta", p_emp: "e-k", p_buddy: "e-v" }).error).toBe("forbidden");
    expect(s.rpc("newbie_list", { p_token: "ta" }).list.map((x) => x.emp)).toEqual(["e-k"]);
    expect(s.rpc("newbie_list", { p_token: "tv" }).list).toEqual([]);
    expect(s.rpc("newbie_me", { p_token: "ta" }).buddy_of).toEqual([{ emp: "e-k", name: "Ксения Миронова" }]);
  });
  it("поздороваться — раз, сам себе — нет; свои шаги — сам, «5 столов» и самостоятельную смену — наставник", () => {
    const s = mk();
    const m = s.rpc("newbie_set", { p_token: "tm", p_emp: "e-k", p_buddy: "e-a", p_hello: true }).msg;
    expect(s.rpc("chat_greet", { p_token: "tv", p_msg: m.id }).msg.card.greet.map((g) => g.id)).toEqual(["e-v"]);
    expect(s.rpc("chat_greet", { p_token: "tv", p_msg: m.id }).msg.card.greet.length).toBe(1);
    expect(s.rpc("chat_greet", { p_token: "tk", p_msg: m.id }).error).toBe("self");
    expect(s.rpc("newbie_check", { p_token: "tk", p_steps: ["d1a", "d2c", "f:Конфликты и сложные ситуации", "zzz"], p_on: true }).checked).toHaveProperty("d1a");
    expect(Object.keys(s.rpc("newbie_me", { p_token: "tk" }).checked).sort()).toEqual(["d1a", "d1c", "f:Конфликты и сложные ситуации"]);
    expect(s.rpc("newbie_confirm", { p_token: "tv", p_emp: "e-k", p_step: "d2c" }).error).toBe("forbidden");
    expect(s.rpc("newbie_confirm", { p_token: "tk", p_emp: "e-k", p_step: "d3b" }).error).toBe("forbidden");
    expect(s.rpc("newbie_confirm", { p_token: "ta", p_emp: "e-k", p_step: "d1a" }).error).toBe("bad_step");
    const r = s.rpc("newbie_confirm", { p_token: "ta", p_emp: "e-k", p_step: "d3b" });
    expect([r.ok, r.item.confirm.d3b.name, !!r.item.solo]).toEqual([true, "Анна Смирнова", true]);
    const solo = s.S.msgs.find((x) => x.card && x.card.t === "solo");
    expect([solo.card.name, solo.card.days, solo.card.buddy.name, solo.body]).toEqual(["Ксения Миронова", 1, "Анна Смирнова", "Первая самостоятельная смена: Ксения Миронова"]);   // первой смены ещё не было — дни с прихода
    expect(s.rpc("chat_newbie_mark", { p_token: "tv", p_emp: "e-a" })).toEqual({ ok: true, now: [], led: [{ name: "Ксения Миронова", solo: solo.at.slice(0, 10) }] });
    s.rpc("newbie_confirm", { p_token: "tm", p_emp: "e-k", p_step: "d3b", p_on: false });
    expect([s.msgOf(solo.id).del, !!s.rpc("newbie_me", { p_token: "tk" }).solo]).toEqual([true, false]);
  });
  it("памятка — руководитель; добавить и убрать из «Новичков»", () => {
    const s = mk();
    expect(s.rpc("newbie_memo_set", { p_token: "tm", p_memo: { addr: " Двор ", arrive: 10, dress: "Чёрное" } }).memo).toEqual({ addr: "Двор", arrive: 10, dress: "Чёрное", meet: "", extra: "" });
    expect(s.rpc("newbie_memo_set", { p_token: "ta", p_memo: {} }).error).toBe("forbidden");
    expect(s.rpc("newbie_add", { p_token: "tm", p_emp: "e-v", p_on: true }).item.emp).toBe("e-v");
    expect(s.rpc("newbie_me", { p_token: "tv" }).newbie).toBe(true);
    s.rpc("newbie_add", { p_token: "tm", p_emp: "e-v", p_on: false });
    expect(s.rpc("newbie_me", { p_token: "tv" }).newbie).toBe(false);
    expect(s.rpc("newbie_add", { p_token: "tm", p_emp: "u-m", p_on: true }).error).toBe("not_found");
  });
});
