// v109 (Доп. 422): «Что дало обучение». Владелец (29.10) выбрал из вариантов «Итог месяца владельцу»: раз в месяц экран и
// сообщение бота — что команда прошла и что изменилось в зале по сравнению с прошлым месяцем. Сервер —
// supabase/supabase-stage43-gain.sql (итог и текст бота сверены с lib/gain.js на Postgres: tools/claude/sql/test43.sh и
// tools/claude/pg-check-stage43.mjs), экран — ui/gain.jsx («Команда» → «Управление»); демо — tools/claude/demo-app.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import {
  GAIN_BACK, GAIN_EARLY, GAIN_HOUR, GAIN_MIN_ANSWERS, GAIN_GREW_MIN, monthAdd, monthNom, monthLow, monthGen, monthPrep, monthIns, gainDefaultMonth, gainMonths, periodLabel,
  gainModel, wrongPct, gainHas, learnRows, hallRows, rowLine, grewNames, grewWhy, topicTitle, topicLine, idleLine, compareLabel, gainText, gainKb,
} from "../lib/gain.js";
import { STAGES, CRON_JOBS } from "../lib/server-check.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");
const OCT = { ok: true, rest: "Два моря, Океан", month: "2026-10", from: "2026-10-01", to: "2026-10-31", partial: false, pfrom: "2026-09-01", pto: "2026-09-30", team: 9,
  learn: { people: 7, lessons: 46, tests: 21, practice: 4, guest: 2, days: 58 }, plearn: { people: 5, lessons: 30, tests: 15, practice: 1, guest: 0, days: 40 },
  quiz: { n: 312, wrong: 28 }, pquiz: { n: 250, wrong: 43 }, topics: [{ id: "s4-q", n: 5, a: 60, w: 7 }, { id: "nope", n: 2, a: 8, w: 1 }], topicsN: 12,
  thanks: { n: 38, prev: 24 }, peer: { n: 7, prev: 3 }, newbies: { n: 2, days: 6, pn: 1, pdays: 11 },
  grew: [{ id: "e-a", n: "Анна С.", pts: 420, ppts: 120, lessons: 14, tests: 9, plessons: 4, ptests: 2, qn: 40, qw: 3, pqn: 30, pqw: 7 }, { id: "e-p", n: "Пётр О.", pts: 300, ppts: 100, lessons: 1, tests: 0, plessons: 0, ptests: 0 }],
  idle: [{ id: "e-d", n: "Дарья Л." }], idleMore: 0 };

describe("v109: слова и месяцы", () => {
  it("месяцы: соседние, названия во всех падежах, какой открыть, какие можно", () => {
    expect([monthAdd("2026-10", -1), monthAdd("2026-01", -1), monthAdd("2026-12", 1)]).toEqual(["2026-09", "2025-12", "2027-01"]);
    expect([monthNom("2026-10"), monthLow("2026-10"), monthGen("2026-10"), monthPrep("2026-10"), monthIns("2026-09"), monthNom("x")]).toEqual(["Октябрь", "октябрь", "октября", "октябре", "сентябрём", ""]);
    expect([gainDefaultMonth("2026-10-07"), gainDefaultMonth("2026-10-08"), gainDefaultMonth("2026-01-03"), gainDefaultMonth("x")]).toEqual(["2026-09", "2026-10", "2025-12", ""]);
    expect(gainMonths("2026-10-30")).toEqual(["2026-10", "2026-09"]);
    expect([periodLabel("2026-10-01", "2026-10-15"), periodLabel("2026-10-01", "2026-10-01"), periodLabel("x", "2026-10-01")]).toEqual(["1–15 октября", "1 октября", ""]);
    expect([GAIN_BACK, GAIN_EARLY, GAIN_HOUR, GAIN_MIN_ANSWERS, GAIN_GREW_MIN]).toEqual([1, 7, 10, 10, 50]);
  });
  it("ответ сервера: мусор и старый сервер — пустые места, а не падение", () => {
    const m = gainModel({ ok: true, month: "2026-13", learn: "x", plearn: null, quiz: { n: "5", wrong: 9 }, topics: [null, { id: "" }, { id: "s1-q", n: "2" }], grew: [{ n: "" }, 7], idle: "x" });
    expect(m).toMatchObject({ month: "", learn: { people: 0, lessons: 0 }, plearn: null, quiz: { n: 5, wrong: 5 }, topics: [{ id: "s1-q", n: 2, a: 0, w: 0 }], grew: [], idle: [], thanks: null, newbies: null });
    expect(gainModel(null).ok).toBe(true);
    expect(gainHas(gainModel({}))).toBe(false); expect(gainHas(OCT)).toBe(true); expect(gainHas({ ...OCT, learn: {}, quiz: null, thanks: null, peer: null, newbies: { n: 1 } })).toBe(true);
  });
  it("строки сравнения: уроки, тесты, кто занимался; «спасибо» — когда они есть; доля ошибок — от 10 ответов", () => {
    const m = gainModel(OCT);
    expect(learnRows(m).map(rowLine)).toEqual(["Уроков: 46, было 30", "Тестов: 21, было 15", "Занимались: 7 из 9, было 5"]);
    expect(hallRows(m).map(rowLine)).toEqual(["«Спасибо» от гостей: 38, было 24", "Ошибок в тестах: 9%, было 17%", "Новички до самостоятельной смены: 6 дней, было 11", "«Спасибо» от коллег: 7, было 3"]);
    expect(hallRows(m).map((x) => x.good)).toEqual([true, true, true, true]);
    const m2 = gainModel({ ...OCT, plearn: null, thanks: { n: 0, prev: 0 }, peer: { n: 0, prev: 2 }, quiz: { n: 9, wrong: 1 }, newbies: { n: 1, days: 1, pn: 0, pdays: 0 } });
    expect(learnRows(m2).map(rowLine)).toEqual(["Уроков: 46", "Тестов: 21", "Занимались: 7 из 9"]);
    expect(hallRows(m2).map(rowLine)).toEqual(["Новички до самостоятельной смены: 1 день", "«Спасибо» от коллег: 0, было 2"]);
    expect(hallRows(m2).map((x) => x.good)).toEqual([null, false]);
    expect([wrongPct({ n: 9, wrong: 1 }), wrongPct({ n: 10, wrong: 1 }), wrongPct(null)]).toEqual([null, 10, null]);
  });
  it("кто вырос и почему, темы, кто не занимался, с чем сравниваем", () => {
    const m = gainModel(OCT);
    expect(grewNames(m)).toBe("Анна С. и Пётр О.");
    expect(m.grew.map(grewWhy)).toEqual(["14 уроков и 9 тестов, было 4 и 2; ошибок 8%, было 23%", "1 урок, было 0"]);
    expect(grewWhy({ lessons: 0, tests: 0, plessons: 0, ptests: 0, qn: 0, pqn: 0 })).toBe("больше занятий, чем месяцем раньше");
    expect(grewWhy({ lessons: 3, tests: 2, plessons: 1, ptests: 1, qn: 20, qw: 6, pqn: 20, pqw: 2 })).toBe("3 урока и 2 теста, было 1 и 1");   // ошибок стало больше — не хвалим
    const titles = { "s4-q": "Тест: работа с жалобами", "s1-q": "Мышление сервиса" };
    expect([topicTitle("s4-q", titles), topicTitle("s1-q", titles), topicTitle("nope", titles)]).toEqual(["Работа с жалобами", "Мышление сервиса", ""]);
    expect([topicLine({ n: 5, a: 60, w: 7 }), topicLine({ n: 1, a: 8, w: 1 }), topicLine({ n: 2, a: 10, w: 0 })]).toEqual(["тест проходили 5 человек, ошибок 12%", "тест проходил 1 человек", "тест проходили 2 человека, ошибок 0%"]);
    expect([idleLine(m), idleLine({ ...m, idle: [{ n: "А" }, { n: "Б" }], idleMore: 3 }), idleLine({ ...m, idle: [{ n: "А" }, { n: "Б" }], idleMore: 0 })]).toEqual(["Дарья Л.", "А, Б и ещё 3", "А и Б"]);
    expect([compareLabel(m), compareLabel({ ...m, partial: true, to: "2026-10-15", pto: "2026-09-15" }), compareLabel({ ...m, pfrom: "", pto: "" })]).toEqual(["сравниваем с сентябрём", "1–15 октября, сравниваем с 1–15 сентября", ""]);
  });
  it("текст бота и кнопка «Открыть итог» (как _sa_gain_text и _sa_gain_kb на сервере)", () => {
    expect(gainText(OCT)).toBe(["<b>Что дало обучение · октябрь</b>", "Два моря, Океан · сравниваем с сентябрём", "", "<b>Чему учились</b>", "Уроков: 46, было 30", "Тестов: 21, было 15",
      "Занимались: 7 из 9, было 5", "", "<b>Что изменилось в зале</b>", "«Спасибо» от гостей: 38, было 24", "Ошибок в тестах: 9%, было 17%", "Новички до самостоятельной смены: 6 дней, было 11",
      "«Спасибо» от коллег: 7, было 3", "", "<b>Больше всех выросли</b>", "Анна С. и Пётр О.", "", "<b>Не занимались</b>", "Дарья Л."].join("\n"));
    expect(gainText({ ...OCT, rest: "A & <B>", grew: [], idle: [], thanks: null, peer: null, newbies: null, quiz: null })).toBe(["<b>Что дало обучение · октябрь</b>", "A &amp; &lt;B&gt; · сравниваем с сентябрём", "",
      "<b>Чему учились</b>", "Уроков: 46, было 30", "Тестов: 21, было 15", "Занимались: 7 из 9, было 5"].join("\n"));
    expect(gainKb(OCT)).toEqual([[{ text: "Открыть итог", go: "gain_2026-10" }]]);
    // без тире между словами, без восклицаний
    expect(gainText(OCT)).not.toMatch(/ — |!/);
  });
});

describe("v109: сервер (этап 43)", () => {
  const sql = rd("supabase/supabase-stage43-gain.sql");
  it("функции приложения, права, расписание, проверка этапов, итог в конце", () => {
    for (const f of ["gain_month(p_token text, p_month text default null)", "gain_send_now(p_token text, p_month text default null)", "_sa_gain_at(p_rest text, p_month date, p_today date)",
      "_sa_gain_text(b jsonb)", "_sa_gain_kb(b jsonb)", "_sa_gain_due(p_send boolean, p_now timestamptz, p_all boolean default false)", "sa_gain_tick()", "sa_gain_preview()"]) expect(sql).toContain("create or replace function " + f);
    expect(sql).toContain("grant execute on function gain_month(text, text), gain_send_now(text, text) to anon, authenticated;");
    expect(sql).toContain("revoke all on function _sa_gain_at(text, date, date) from public, anon, authenticated;");
    expect(sql).toContain("cron.schedule('sa-gain', '*/10 * * * *', 'select public.sa_gain_tick()')");
    for (const n of ["21", "23", "24", "31", "38"]) expect(sql).toMatch(new RegExp("Сначала этап " + n));
    expect(sql).toContain("select 'что дало обучение: ' ||");
    // функции с токеном — не stable (тест v91: вход может обновить сессию)
    expect(sql).not.toMatch(/function gain_month[^$]*\$\$[^$]*stable/);
  });
  it("правила: 1-го числа с 10 до 21, раз в месяц; журнал занятий — 75 дней; выросли — от 50 очков; пришедшие позже — не в команде", () => {
    expect(sql).toContain("due := extract(day from ld) = 1 and extract(hour from lnow) >= 10 and extract(hour from lnow) < 21;");
    expect(sql).toContain("if not _sa_tg_once(e.emp_id, m0, 'gain') then continue; end if;");
    expect(sql).toContain("lok := pf >= p_today - 74;");
    expect(sql).toContain("from s where (s.c->>'pts')::int >= 50 and (s.c->>'pts')::int > s.pp");
    expect(sql).toContain("and not exists (select 1 from sa_newbies nb where nb.emp_id = e.id::text and (nb.started_at at time zone $4)::date > $3)");
    expect(sql).toContain("if not _sa_gain_has(b) then continue; end if;");
  });
  it("тексты сервера — те же слова, что lib/gain.js", () => {
    for (const w of ["'<b>Что дало обучение · '", "'<b>Чему учились</b>'", "'Уроков: '", "'Тестов: '", "'Занимались: '", "'<b>Что изменилось в зале</b>'", "'«Спасибо» от гостей: '",
      "'Ошибок в тестах: '", "'Новички до самостоятельной смены: '", "'«Спасибо» от коллег: '", "'<b>Больше всех выросли</b>'", "'<b>Не занимались</b>'", "', сравниваем с '", "'сравниваем с '",
      "'Открыть итог'", "' и ещё '"]) expect(sql).toContain(w);
  });
  it("«Сервер» в приложении знает этап 43 и расписание sa-gain", () => {
    expect(STAGES.find((s) => s.n === "43")).toMatchObject({ file: "supabase-stage43-gain.sql", fn: "gain_month" });
    expect(CRON_JOBS.find((c) => c.name === "sa-gain")).toMatchObject({ n: "43" });
  });
});

describe("v109: приложение", () => {
  it("«Команда» → «Управление» → «Что дало обучение» сразу под «Аналитикой»; ссылка бота ?go=gain_<месяц>; значок", () => {
    const app = rd("App.jsx");
    expect(app).toContain('const GainScreen = lazyOf(() => import("./ui/gain"), "GainScreen");');
    const an = app.indexOf('staff && { key:"an", group:"Управление"'), gain = app.indexOf('staff && { key:"gain", group:"Управление", icon:"gain", label:"Что дало обучение"');
    expect(an).toBeGreaterThan(0); expect(gain).toBeGreaterThan(an); expect(app.slice(an, gain).split("\n").length).toBe(2);
    expect(app).toContain('sub:"Чему учились и что изменилось в зале", onClick:() => { setGainMonth(""); navigate("gain"); } }');
    expect(app).toContain('/^gain(_\\d{4}-(0[1-9]|1[0-2]))?$/.test(v)');
    expect(app).toContain('else if (g === "gain" || /^gain_/.test(g)) { setGainMonth(g.slice(5)); navigate("gain"); }');
    expect(app).toContain('{screen === "gain" && profile && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><GainScreen T={T} a11y={a11y} profile={profile} month={gainMonth}');
    expect(rd("ui/home-hubs.jsx")).toMatch(/\n {2}gain: \(c\) => <svg /);
  });
  it("экран рисуется (до ответа сервера), назад — линза; слова экрана — без тире между словами", async () => {
    const { GainScreen } = await import("../ui/gain.jsx");
    const T = { screen: {}, lessHead: {}, backBtn2: {}, lessHeadTitle: {}, modCard: {}, para: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" } };
    const h = renderToString(React.createElement(GainScreen, { T, a11y: false, profile: { name: "Мария", position: "manager" }, onBack: () => {} }));
    expect(h).toContain('data-gain="load"'); expect(h).toContain("Что дало обучение"); expect(h).toContain('data-lens="back"'); expect(h).toContain("Собираю итог месяца");
    const src = rd("ui/gain.jsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g)).toBe(null);
    for (const a of ["data-gain-month", "data-gain-period", 'data-gain-sec="learn"', 'data-gain-sec="hall"', 'data-gain-sec="topics"', 'data-gain-sec="grew"', 'data-gain-sec="idle"', 'data-gain-sec="tg"',
      "data-gain-stat", "data-gain-nudge", "data-gain-send", "data-gain-nolearn", "data-gain-missing"]) expect(src).toContain(a);
    expect(src).toContain('rpc("gain_month", { p_token: saToken(), p_month: m || null })');
    expect(src).toContain('rpc("gain_send_now", { p_token: saToken(), p_month: st.m.month })');
    expect(src).toContain('rpc("morning_nudge", { p_token: saToken(), p_emp: id })');
  });
});

describe("v109: демо-сервер — то же, что этап 43", () => {
  const P = [{ id: "u-m", name: "Мария", surname: "Ким", restaurant: "R", position: "manager" }, { id: "e-a", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter" },
    { id: "e-p", name: "Пётр", surname: "Орлов", restaurant: "R", position: "waiter" }, { id: "e-k", name: "Ксения", surname: "Миронова", restaurant: "R", position: "waiter" },
    { id: "u-r", name: "Роман", surname: "", restaurant: "R", position: "owner", is_admin: true }];
  const TOK = { tm: "u-m", ta: "e-a", tr: "u-r" };
  const mk = (o = {}) => makeServer({ today: "2026-10-20", rest: "R", people: P, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], tgLinked: ["u-m"], cheers: false,
    activity: { "e-a": { "-40": { st: 2, l: 1, q: 1 }, "-5": { st: 3, l: 2, q: 1 }, "-3": { st: 3, l: 2, q: 1 } }, "e-k": { "-2": { st: 1, l: 1 } } },
    quiz: [{ emp: "e-a", lesson: "s4-q", at: -5, n: 10, w: 1 }, { emp: "e-a", lesson: "s4-q", at: -40, n: 10, w: 4 }],
    thanks: [{ emp: "e-a", at: -3 }, { emp: "e-a", at: -2, hidden: true }, { emp: "e-a", at: -33 }], newbies: [{ emp: "e-k", started: -4 }], ...o });
  it("итог месяца: идёт — с теми же днями прошлого; кто пришёл позже, в прошлом месяце не считается", () => {
    const s = mk(), g = s.rpc("gain_month", { p_token: "tm" });
    expect(g).toMatchObject({ ok: true, month: "2026-10", from: "2026-10-01", to: "2026-10-20", partial: true, pfrom: "2026-09-01", pto: "2026-09-20", team: 4,
      learn: { people: 2, lessons: 5, tests: 2, days: 3 }, plearn: { people: 1, lessons: 1, tests: 1, days: 1 }, quiz: { n: 10, wrong: 1 }, pquiz: { n: 10, wrong: 4 },
      thanks: { n: 1, prev: 1 }, months: ["2026-10", "2026-09"], today: "2026-10-20", tg: { bot: true, linked: true } });
    expect(g.topics).toEqual([{ id: "s4-q", n: 1, a: 10, w: 1 }]);
    expect(g.grew.map((x) => x.n + ":" + x.pts + ":" + x.ppts)).toEqual(["Анна С.:70:25"]);   // 2 урока и тест в день: 35 очков
    expect(g.idle.map((x) => x.n)).toEqual(["Мария К.", "Пётр О."]);
    const p = s.rpc("gain_month", { p_token: "tm", p_month: "2026-09" });
    expect(p).toMatchObject({ partial: false, to: "2026-09-30", pto: "2026-08-31", team: 3, plearn: null, grew: [] });   // август за 75 днями; Ксении в сентябре ещё не было
    expect([s.rpc("gain_month", { p_token: "ta" }).error, s.rpc("gain_month", { p_token: "tm", p_month: "2026-08" }).error, s.rpc("gain_month", { p_token: "x" }).error]).toEqual(["forbidden", "month", "auth"]);
  });
  it("«Прислать в Telegram»: сообщение бота с кнопкой «Открыть итог»; раз в минуту; без Telegram — not_linked", () => {
    const pings = [], s = mk({ ping: (to, text, acts, chat, msg, o) => pings.push({ to, text, o }) });
    const r = s.rpc("gain_send_now", { p_token: "tm" });
    expect(r).toEqual({ ok: true, sent: true, month: "2026-10" });
    expect(pings[0].to).toBe("u-m"); expect(pings[0].text).toBe(gainText(s.rpc("gain_month", { p_token: "tm" }))); expect(pings[0].o).toEqual({ kind: "gain", kb: [[{ text: "Открыть итог", go: "gain_2026-10" }]] });
    expect([s.rpc("gain_send_now", { p_token: "tm" }).error, s.rpc("gain_send_now", { p_token: "tr" }).error]).toEqual(["too_fast", "not_linked"]);
  });
  it("ответы в тестах и день журнала из приложения попадают в итог", () => {
    const s = mk();
    expect(s.rpc("log_quiz_answer", { p_token: "ta", p_lesson: "s1-q", p_correct: false })).toEqual({ ok: true });
    expect(s.rpc("sa_day_push", { p_token: "ta", p_day: "2026-10-20", p_rec: { st: 2, l: 1, zz9: 5 } })).toEqual({ ok: true });
    expect(s.rpc("sa_day_push", { p_token: "ta", p_day: "2026-10-20", p_rec: { st: 1, q: 1 } })).toEqual({ ok: true });
    expect(s.S.act["e-a"]["2026-10-20"]).toEqual({ st: 2, l: 1, q: 1 });
    const g = s.rpc("gain_month", { p_token: "tm" });
    expect(g.quiz).toEqual({ n: 11, wrong: 2 }); expect(g.learn).toMatchObject({ lessons: 6, tests: 3, days: 4 });
  });
});
