// v83 (Доп. 396): случаи из нашего зала. Сотрудник рассказывает случай со смены, руководитель разбирает его в ситуацию
// для тренировки, команда тренируется на случаях своего заведения тем же «столом», что и практика (режим cases);
// свежий случай попадает в брифинг смены (v82). Вид — tools/claude/e2e-v83.mjs, сервер — tools/claude/sql/test33.sh.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { CASE_OUTCOMES, outcomeLabel, caseDraft, draftProblem, draftToSit, caseNote, casesToSits, isCaseMistake, readPlayed, markPlayed, readSince, markSince, casesSub, CASES_TOPIC } from "../lib/cases.js";
import { briefCase, buildBrief, briefText, briefShown, BRIEF_ORDER } from "../lib/briefing.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _m: m }; };

const SIT = (scene, right, wrong, why, real = "") => ({ scene, question: "Как поступить?", options: [right, ...wrong], correct: 0, why, real, show_author: true });
const TEAM = [
  { id: 31, at: "2026-10-22T09:00:00Z", author: "Илья Бармен", sit: SIT("Гость за баром просит коктейль не из карты.", "Предложить похожий из карты", ["Сказать, что такого нет"], "Гость пришёл за вкусом, а не за названием", "Предложили «Апероль шприц»") },
  { id: 32, at: "2026-10-21T09:00:00Z", author: null, sit: SIT("Гость просит пересадить, мест нет.", "Извиниться и предложить плед", ["Сказать, что мест нет", "Уйти"], "Гостю важна забота сейчас.") },
  { id: 33, at: "2026-10-20T09:00:00Z", author: "Анна", sit: SIT("Гость просит счёт до десерта.", "Уточнить про десерт", ["Принести счёт молча"], "Вопрос бережёт и время, и чек.") },
  { id: 34, at: "2026-10-19T09:00:00Z", author: "Битый", sit: { scene: "", options: ["а"], correct: 0 } },
];

describe("v83: разбор случая", () => {
  it("итоги случая — четыре, с подписями", () => {
    expect(CASE_OUTCOMES.map((x) => x[0])).toEqual(["ok", "saved", "bad", "unsure"]);
    expect([outcomeLabel("bad"), outcomeLabel("unsure"), outcomeLabel("x")]).toEqual(["Гость ушёл недовольным", "Не знаю, как было надо", ""]);
  });
  it("черновик: сцена — рассказ; что сделали — неверным вариантом, если вышло плохо или «не знаю»; «как было у нас»", () => {
    const bad = caseDraft({ story: "  Гость  ругался из-за счёта  ", did: "Позвала менеджера", outcome: "bad", anon: false });
    expect(bad).toEqual({ scene: "Гость ругался из-за счёта", question: "Как поступить?", right: "", wrong: ["Позвала менеджера", "", ""], why: "",
      real: "Что сделали: Позвала менеджера. Итог: гость ушёл недовольным.", showReal: true, showAuthor: true });
    const good = caseDraft({ story: "Гость просил плед", did: "Принесла плед", outcome: "ok", anon: true });
    expect(good.wrong).toEqual(["", "", ""]);
    expect(good.real).toBe("Что сделали: Принесла плед. Итог: гость доволен.");
    expect(good.showAuthor).toBe(false);   // без имени
    expect(caseDraft({ story: "Тихий вечер, ничего", did: "", outcome: "" }).showReal).toBe(false);
  });
  it("опубликованный случай правится как есть: верный и неверные из ситуации", () => {
    const d = caseDraft({ story: "x", anon: false, sit: { scene: "Сцена", question: "Что первым?", options: ["Неверно", "Верно", "Тоже нет"], correct: 1, why: "Потому что", real: "Было так", show_author: false } });
    expect(d).toEqual({ scene: "Сцена", question: "Что первым?", right: "Верно", wrong: ["Неверно", "Тоже нет", ""], why: "Потому что", real: "Было так", showReal: true, showAuthor: false });
  });
  it("что мешает опубликовать — первая причина", () => {
    const ok = { scene: "Гость просит пересадить", right: "Плед", wrong: ["Нет мест", ""], why: "Забота сейчас" };
    expect(draftProblem(ok)).toBe("");
    expect(draftProblem({ ...ok, scene: "Коротко" })).toMatch(/^Опиши ситуацию/);
    expect(draftProblem({ ...ok, right: " " })).toBe("Напиши, как правильно");
    expect(draftProblem({ ...ok, wrong: ["", ""] })).toBe("Добавь хотя бы один неверный вариант");
    expect(draftProblem({ ...ok, wrong: ["плед "] })).toBe("Варианты повторяются");
    expect(draftProblem({ ...ok, why: "" })).toMatch(/^Напиши разбор/);
  });
  it("ситуация для сервера: верный — первым, пустые неверные выброшены, «как было» — только если показывать", () => {
    const d = { scene: " Гость  просит пересадить ", question: "", right: "Плед", wrong: ["Нет мест", "", "Уйти"], why: "Забота", real: "Пересадили", showReal: false, showAuthor: true };
    expect(draftToSit(d)).toEqual({ scene: "Гость просит пересадить", question: "Как поступить?", options: ["Плед", "Нет мест", "Уйти"], correct: 0, why: "Забота", real: "", show_author: true });
    expect(draftToSit({ ...d, showReal: true }).real).toBe("Пересадили");
  });
});

describe("v83: тренировка на случаях", () => {
  it("разбор после ответа: почему, как было у нас, кто рассказал — одним абзацем", () => {
    expect(caseNote(TEAM[0])).toBe("Гость пришёл за вкусом, а не за названием. Как было у нас: Предложили «Апероль шприц». Случай рассказал(а) Илья Бармен.");
    expect(caseNote(TEAM[1])).toBe("Гостю важна забота сейчас.");
  });
  it("ситуации «стола»: несыгранные первыми, битые выброшены, тема «Случаи из нашего зала», ошибка помечена case-…", () => {
    const s = casesToSits(TEAM, { 31: 1 });
    expect(s.map((x) => x._case)).toEqual([32, 33, 31]);
    expect(s[0]).toMatchObject({ id: "case-32", genre: "action", question: "Как поступить?", correct: 0, _from: "case-32", _fromTitle: CASES_TOPIC });
    expect(s[0].win).toBe(s[0].fail);
    expect(casesToSits(TEAM, {}, 2).map((x) => x._case)).toEqual([31, 32]);
    expect(casesToSits([], {})).toEqual([]);
    expect(isCaseMistake({ lessonId: "case-31" })).toBe(true);
    expect(isCaseMistake({ lessonId: "s0-q" })).toBe(false);
    expect(isCaseMistake(null)).toBe(false);
  });
  it("сыгранные и «смотрел» — на телефоне, у каждого свои; старые сыгранные подрезаются", () => {
    const ls = mem();
    expect(readPlayed("_A", ls)).toEqual({});
    markPlayed("_A", [31, 32, null], ls);
    expect(readPlayed("_A", ls)).toEqual({ 31: 1, 32: 1 });
    expect(readPlayed("_B", ls)).toEqual({});
    markPlayed("_A", Array.from({ length: 400 }, (_, i) => 1000 + i), ls);
    expect(Object.keys(readPlayed("_A", ls)).length).toBe(300);
    expect(readSince("_A", ls)).toBe("");
    markSince("_A", "2026-10-23T02:20:00.000Z", ls);
    expect(readSince("_A", ls)).toBe("2026-10-23T02:20:00.000Z");
  });
  it("подпись пункта в «Смене»: ждут разбора (руководителю), новые, ответ на свой; иначе — сколько случаев", () => {
    expect(casesSub({ inbox: 2, fresh: 3, mine_new: 1 }, true)).toBe("2 ждут разбора · 3 новых случая · ответ на твой случай");
    expect(casesSub({ inbox: 2, fresh: 0 }, false)).toBe("Расскажи свой, команда потренируется");   // v110: подпись в одну строку
    expect(casesSub({ team: 5 }, false)).toBe("5 случаев для тренировки. Расскажи свой");
    expect(casesSub({ inbox: 1 }, true)).toBe("1 ждёт разбора");
    expect(casesSub({ fresh: 1 }, false)).toBe("1 новый случай");
    expect(casesSub(null, false)).toBe("Расскажи свой, команда потренируется");
  });
});

describe("v83: случай в брифинге смены", () => {
  const top = { id: 31, author: "Илья Бармен", sit: TEAM[0].sit };
  it("свежий опубликованный случай — блок «Случай из зала» (после «Вопроса команде»); битый — нет", () => {
    expect(BRIEF_ORDER.indexOf("case")).toBe(BRIEF_ORDER.indexOf("ask") + 1);
    expect(briefCase(top)).toEqual({ id: 31, q: "Гость за баром просит коктейль не из карты.", question: "Как поступить?", options: ["Предложить похожий из карты", "Сказать, что такого нет"], correct: 0,
      why: "Гость пришёл за вкусом, а не за названием", real: "Предложили «Апероль шприц»", author: "Илья Бармен" });
    expect(briefCase(TEAM[3])).toBeNull();
    expect(briefCase(null)).toBeNull();
    const b = buildBrief({ caseTop: top, now: new Date(2026, 9, 25) });
    expect(b.on.case).toBe(true);
    expect(briefShown(b, "case")).toBe(true);
  });
  it("в тексте для Telegram — сцена и вопрос, ответа и «как было» нет", () => {
    const t = briefText(buildBrief({ caseTop: top, now: new Date(2026, 9, 25) }));
    expect(t).toContain("Случай из зала: «Гость за баром просит коктейль не из карты.» Как поступить? Разбор в приложении.");
    expect(t).not.toContain("Апероль");
    expect(t).not.toContain("Предложить похожий");
  });
  it("у сотрудника и в показе ответ — по кнопке, отдельной у вопроса команде и у случая", async () => {
    const { BriefView } = await import("../ui/briefing.jsx");
    const data = buildBrief({ caseTop: top, note: "x", now: new Date(2026, 9, 25) });
    const html = R(h(BriefView, { a11y: false, brief: { data, author: "Мария" }, onClose: () => {} }));
    expect(html).toContain('data-brief-block="case"');
    expect(html).toContain("Рассказал(а) Илья Бармен");
    expect(html).not.toContain("Как было у нас");
    const src = rd("ui/briefing.jsx");
    expect(src).toContain('const HIDDEN = { ask: true, case: true };');
    expect(src).toContain("reveal={!HIDDEN[k] || !!shown[k]} onReveal={() => setShown((s) => ({ ...s, [k]: true }))}");
    expect(src).toContain('rpc("case_list", { p_token: tok, p_mode: "counts" })');
  });
});

describe("v83: экран и приложение", () => {
  const app = rd("App.jsx");
  it("экран случаев рисуется до ответа сервера: «Загружаю случаи…»", async () => {
    const { CasesScreen } = await import("../ui/cases.jsx");
    const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, lessHead: {}, lessHeadTitle: {}, backBtn2: {} };
    const html = R(h(CasesScreen, { T, a11y: false, profile: { name: "Анна", surname: "С", restaurant: "Два моря, Океан" }, uk: "_Анна_С", onBack: () => {}, onPlay: () => {} }));
    expect(html).toContain("Случаи из нашего зала");
    expect(html).toContain("Загружаю случаи…");
  });
  it("«Смена» → «Потренироваться»: пункт после «Задания дня», без этапа 33 — нет; ссылка ?go=cases; экран лениво", () => {
    expect(app).toContain('const CasesScreen = lazyOf(() => import("./ui/cases"), "CasesScreen");');
    expect(app).not.toMatch(/^import [^\n]*from "\.\/ui\/cases"/m);
    const daily = app.indexOf('{ key:"daily", group:"Потренироваться"'), cases = app.indexOf('casesOn && { key:"cases", group:"Потренироваться", icon:"cases", label:"Случаи из нашего зала", sub: casesSub(caseCounts, isLead)');
    expect(daily).toBeGreaterThan(0);
    expect(cases).toBeGreaterThan(daily);
    expect(app).toContain("if (rpcMissing(r)) { st.off = true; setCasesOn(false); return; }");
    expect(app).toContain('rpc("case_list", { p_token: saToken(), p_mode: "counts", p_since: readSince(ukP) || null })');
    expect(app).toMatch(/"mistakes", "brief", "cases"[^\]]*\]\.includes\(v\)/);
    expect(app).toContain('else if (g === "cases") navigate("cases");');
    expect(rd("ui/home-hubs.jsx")).toContain("cases: (c) => <svg");
  });
  it("тренировка — тот же «стол» (режим cases); итог запоминает сыгранные; ошибки из случаев уборка банка не трогает", () => {
    expect(app).toContain('setSpecial({ mode: "cases", sits, key: Date.now(),');
    expect(app).toContain("markPlayed(ukP, (sp.sits || []).map((x) => x && x._case)); setCasesPlayed((v) => v + 1); touchStreak();");
    expect(app).toContain("setMistakeBank(prev => { const next = prev.filter(m => (isCaseMistake(m) || (m.from === \"practice\" ? livePQ.has(m.q) : liveQ.has(m.q))));");
    expect(app).toContain('special.mode === "credit" || special.mode === "probe" || special.mode === "cases" ? null :');
    expect(rd("ui/table.jsx")).toContain('cases: { title: "Случаи из нашего зала", icon: "guest", done: "Случаи разобраны"');
  });
  it("«Напоминания в Telegram»: строка «Случаи из зала» — только когда сервер её знает", async () => {
    const { prefRows } = await import("../ui/day-cards");
    const base = { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true, qday: true, qday_hour: 12, brief: true };
    expect(prefRows(base).map((r) => r[0])).not.toContain("cases");
    const rows = prefRows({ ...base, cases: true });
    expect(rows[rows.length - 1]).toEqual(["cases", "Случаи из зала", "когда разобрали твой случай, а старшим о новых случаях"]);
  });
  it("тексты экрана — без тире между словами и без восклицаний", () => {
    for (const f of ["ui/cases.jsx", "lib/cases.js"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
    }
  });
});

describe("v83: этап 33 на сервере", () => {
  const sql = rd("supabase/supabase-stage33-cases.sql");
  it("команде — только ситуация от руководителя; имя — если автор не просил без имени и руководитель оставил «показывать»", () => {
    expect(sql).toContain("when 'team' then jsonb_build_object('id', c.id, 'sit', c.sit, 'at', c.published_at,");
    expect(sql).toContain("'author', case when c.anon or not coalesce((c.sit->>'show_author')::boolean, true) then null else c.author_name end)");
    expect(sql).toContain("'show_author', coalesce((p_sit->>'show_author')::boolean, true) and not r.anon);");
  });
  it("рассказать: от 20 знаков, итог из четырёх, не больше пяти в день; руководителям — раз в день", () => {
    expect(sql).toContain("if length(st) < 20 then return jsonb_build_object('ok', false, 'error', 'short'); end if;");
    expect(sql).toContain("oc not in ('', 'ok', 'saved', 'bad', 'unsure')");
    expect(sql).toContain("if n >= 5 then return jsonb_build_object('ok', false, 'error', 'limit'); end if;");
    expect(sql).toContain("if not _sa_tg_once(l.emp_id, ld, 'case_new') then continue; end if;");
    expect(sql).toContain("and lower(coalesce(to_jsonb(e)->>'position', '')) in ('senior', 'manager')");
  });
  it("разобрать: руководитель своего заведения; автор удаляет свой неразобранный; ситуация проверяется; автору — один раз", () => {
    expect(sql).toContain("if p_action = 'delete' and r.author_id = c->>'id' and r.status = 'new' then");
    expect(sql).toContain("if not lead then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");
    expect(sql).toContain("or coalesce(n, 0) < 2 or n > 4 or nd <> n or k < 0 or k >= n");
    expect(sql).toContain("published_at = coalesce(published_at, now())");
    expect(sql).toContain("if was = 'new' and r.author_id <> c->>'id' and _sa_tg_ready() then");
  });
  it("права: таблица и счётчик закрыты, служебная функция — нет, три функции — приложению", () => {
    expect(sql).toContain("revoke all on table sa_cases from public, anon, authenticated;");
    expect(sql).toContain("revoke all on sequence sa_cases_id_seq from public, anon, authenticated;");
    expect(sql).toContain("revoke all on function _sa_case_json(sa_cases, text) from public, anon, authenticated;");
    expect(sql).toContain("grant execute on function case_list(text, text, timestamptz) to anon, authenticated;");
    expect(sql).toContain("alter table sa_notify_prefs add column if not exists cases boolean not null default true;");
  });
});

describe("v83: метка и журнал", () => {
  it("«сборка v83», «Дополнение 396»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(8[3-9]|9\d|\d{3,})<\/span>/);   // v83 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 396 — случаи из нашего зала: живые истории смены становятся тренировкой команды (v83)");
  });
});
