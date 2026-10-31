// v125 (Доп. 438): «Кто выучил новые вина» — тренировка по винам на сервере (этап 44) и сводка руководителю. Владелец
// (31.10): «Да, давай сделаем» — как «Кто выучил новинки» у меню. supabase/supabase-stage44-wines.sql (sa_wine_progress,
// wine_progress_set, wine_progress_team), lib/wine-train.js (wineStats, teamRow, teamRows, teamSummary), ui/wine-train.jsx
// (wineReport, WineTeam, пункт тренировки), ui/wine-list.jsx (экран, «Выучил новые вина» — на сервер), сервер демо — как SQL.
// e2e — tools/claude/e2e-v125.mjs; сверка сервера демо с Postgres — tools/claude/pg-check-stage44.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import * as W from "../lib/wine.js";
import * as R from "../lib/wine-train.js";
import { STAGES } from "../lib/server-check.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const SQL = rd("supabase/supabase-stage44-wines.sql"), S = SQL.replace(/--[^\n]*/g, "");
const NOW = Date.parse("2026-10-31T12:00:00Z"), DAY = 864e5;
const mk = (o, id, opt = {}) => W.normWine({ ...o }, { id, ...opt });
// карта: два новых вина бокалом, «Пино» бокалом, но в стоп-листе; «Кьянти» — давно; «Розе» ждёт проверки; «Архив»
const CARD = [
  mk({ name: "Просекко", color: "sparkling", byGlass: true, addedAt: NOW - 2 * DAY }, "w-pro"),
  mk({ name: "Шабли", color: "white", byGlass: true, addedAt: NOW - 2 * DAY }, "w-cha"),
  mk({ name: "Пино Нуар", color: "red", byGlass: true, stop: { since: 1 } }, "w-pin"),
  mk({ name: "Кьянти", color: "red" }, "w-chi"),
  mk({ name: "Розе", color: "rose", byGlass: true, grapes: ["гренаш"] }, "w-ros", { ai: ["grapes"] }),
  mk({ name: "Архив", color: "red", archived: true }, "w-old"),
];
const FRESH = R.newWines(CARD, NOW);

describe("v125: этап 44 — таблица и функции", () => {
  it("таблица: строка на сотрудника в заведении, закрыта (RLS, без прав); нужен этап 21; ничего не удаляет", () => {
    expect(S).toContain("create table if not exists sa_wine_progress (");
    for (const c of ["passed_ids   text[] not null default '{}'", "opened_ids   text[] not null default '{}'", "known        int, total int", "glass_known  int, glass_total int",
      "quiz_right   int, quiz_of int, quiz_at timestamptz", "updated_at   timestamptz not null default now()", "primary key (restaurant, emp_id)"]) expect(S, c).toContain(c);
    expect(S).toContain("alter table sa_wine_progress enable row level security;");
    expect(S).toContain("revoke all on table sa_wine_progress from public, anon, authenticated;");
    expect(S).toContain("to_regprocedure('public._sa_caller(text)') is null");
    expect(S).not.toMatch(/\bdrop\s+(table|function|policy|index)\b|\bdelete\s+from\b|\btruncate\b/i);
  });
  it("wine_progress_set: только про себя (по токену); четыре вида; викторина без «из скольких» — ничего не пишет, даже строку", () => {
    expect(S).toContain("create or replace function wine_progress_set(p_token text, p_kind text, p_data jsonb default '{}'::jsonb)");
    const fn = S.slice(S.indexOf("function wine_progress_set"), S.indexOf("function wine_progress_team"));
    expect(fn).toContain("security definer set search_path to public");
    expect(fn).toContain("c := _sa_caller(p_token);");
    expect(fn).toContain("rest := coalesce(c->>'restaurant', ''); me := c->>'id';");
    expect(fn).not.toMatch(/p_emp|p_restaurant/);
    expect(fn).toContain("p_kind not in ('opened', 'passed', 'stats', 'quiz')");
    expect(fn.indexOf("'error', 'quiz'")).toBeGreaterThan(0);
    expect(fn.indexOf("'error', 'quiz'")).toBeLessThan(fn.indexOf("insert into sa_wine_progress"));
    expect(fn).toContain("on conflict (restaurant, emp_id) do nothing");
    // «сколько» не больше «из скольких» — и у счёта «Знаю?», и у бокалов, и у викторины
    expect(fn).toContain("coalesce(_sa_wp_cap(_sa_wp_int(st->'known'), _sa_wp_int(st->'total')), 0)");
    expect(fn).toContain("_sa_wp_cap(_sa_wp_int(st->'glassKnown'), _sa_wp_int(st->'glassTotal'))");
    expect(fn).toContain("coalesce(_sa_wp_cap(_sa_wp_int(qz->'right'), _sa_wp_int(qz->'of')), 0)");
    expect(fn).toContain("_sa_wp_int(st->'total') is not null");
  });
  it("разбор присланного: id — строки до 60 знаков, без повторов, первые 300; числа 0…100000; «не больше» не теряет пустое", () => {
    expect(S).toContain("left(btrim(e #>> '{}'), 60)");
    expect(S).toContain("jsonb_typeof(e) = 'string' and btrim(e #>> '{}') <> ''");
    expect(S).toContain("select distinct on (x) x, o");
    expect(S).toContain("where o <= 300");
    expect(S).toContain("greatest(0, least(100000, floor((v #>> '{}')::numeric)))::int");
    expect(S).toContain("case when a is null then null when b is null then a else least(a, b) end");
  });
  it("wine_progress_team: руководителю своего заведения, другим — только сеть; без владельца и уволенных; кто прислал — выше", () => {
    expect(S).toContain("create or replace function wine_progress_team(p_token text, p_restaurant text default null)");
    const fn = S.slice(S.indexOf("function wine_progress_team"));
    expect(fn).toContain("security definer set search_path to public");
    expect(fn).toContain("if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'");
    expect(fn).toContain("rest is distinct from c->>'restaurant' and not coalesce((c->>'network')::boolean, false)");
    expect(fn).toContain("coalesce(e.status, 'active') = 'active' and not coalesce(e.is_admin, false)");
    expect(fn).toContain("order by (p.updated_at is null), e.name, e.surname, e.id::text");
    for (const k of ["id", "name", "pos", "passed", "passedAt", "opened", "openedAt", "known", "total", "glassKnown", "glassTotal", "statsAt", "quizRight", "quizOf", "quizAt", "at"]) expect(fn, k).toContain(`'${k}', `);
  });
  it("права: служебные закрыты, две функции — anon и authenticated; схема перечитывается; итог одной строкой", () => {
    for (const f of ["_sa_wp_ids(jsonb)", "_sa_wp_int(jsonb)", "_sa_wp_cap(int, int)"]) expect(S, f).toContain(`revoke all on function ${f} from public, anon, authenticated;`);
    expect(S).toContain("revoke all on function wine_progress_set(text, text, jsonb), wine_progress_team(text, text) from public;");
    expect(S).toContain("grant execute on function wine_progress_set(text, text, jsonb), wine_progress_team(text, text) to anon, authenticated;");
    expect(S).toContain("notify pgrst, 'reload schema';");
    expect(S).toContain("' функции из 2'");
  });
  it("«Проверка сервера» и supabase/README знают этап 44", () => {
    expect(STAGES.find((s) => s.n === "44")).toEqual({ n: "44", file: "supabase-stage44-wines.sql", what: "Кто выучил новые вина", fn: "wine_progress_team" });
    expect(rd("supabase/README.md")).toContain("supabase-stage44-wines.sql");
  });
});

describe("v125: lib — счёт «Знаю?» и команда", () => {
  it("счёт «Знаю?»: из проверенных живых вин; бокалом — без стоп-листа; срок повтора прошёл — не выучено", () => {
    const sr = { "w-pro": { stage: 1, due: NOW + DAY }, "w-chi": { stage: 2, due: NOW + 3 * DAY }, "w-cha": { stage: 1, due: NOW - 1 }, "w-ros": { stage: 3, due: NOW + DAY }, "w-old": { stage: 3, due: NOW + DAY } };
    expect(R.wineStats(CARD, sr, NOW)).toEqual({ known: 2, total: 4, glassKnown: 1, glassTotal: 2 });
    expect(R.wineStats(CARD, {}, NOW)).toEqual({ known: 0, total: 4, glassKnown: 0, glassTotal: 2 });
    expect(R.wineStats([], null, NOW)).toEqual({ known: 0, total: 0, glassKnown: 0, glassTotal: 0 });
  });
  it("строка сотрудника — по ТЕКУЩИМ новым винам: выучил все, учит (открывал или выучил часть), не открывал, не занимался", () => {
    expect(FRESH.map((w) => w.id)).toEqual(["w-pro", "w-cha"]);
    const r = (o) => R.teamRow({ id: "x", name: "Икс", at: "2026-10-31T09:00:00Z", ...o }, FRESH);
    expect(R.teamRow({ id: "x", name: "Икс" }, FRESH)).toMatchObject({ state: "none", left: 2, passed: [], opened: [] });
    expect(r({ passed: ["w-pro", "w-cha", "w-old"] })).toMatchObject({ state: "passed", left: 0 });
    expect(r({ passed: ["w-pro"] })).toMatchObject({ state: "opened", left: 1 });
    expect(r({ opened: ["w-cha"] })).toMatchObject({ state: "opened", left: 2 });
    expect(r({ passed: ["w-gone"], known: 3, total: 4 })).toMatchObject({ state: "notnew", left: 2, known: 3 });
    expect(r({ passed: null, opened: "w-pro" })).toMatchObject({ state: "notnew", passed: [], opened: [] });
    // новых вин нет — просто «занимается»; добавили вино — выучившему снова есть что учить
    expect(R.teamRow({ id: "x", at: "t", passed: ["w-pro"] }, [])).toMatchObject({ state: "active", left: 0 });
    const more = [...FRESH, mk({ name: "Гави", color: "white", addedAt: NOW - DAY }, "w-gav")];
    expect(R.teamRow({ id: "x", at: "t", passed: ["w-pro", "w-cha"] }, more)).toMatchObject({ state: "opened", left: 1 });
  });
  it("команда: выучившие — выше, потом учат, не открывали, не занимались; внутри — по имени; итог одной строкой", () => {
    const rows = R.teamRows([
      { id: "1", name: "Яна Ли", at: "t" }, { id: "2", name: "Вера Соколова" }, { id: "3", name: "Анна Смирнова", at: "t", passed: ["w-pro", "w-cha"] },
      { id: "4", name: "Борис Ким", at: "t", opened: ["w-pro"] }, { id: "5", name: "Аркадий Орлов" }, null, { name: "без id" }], FRESH);
    expect(rows.map((x) => x.id + ":" + x.state)).toEqual(["3:passed", "4:opened", "1:notnew", "5:none", "2:none"]);
    expect(R.teamSummary(rows)).toEqual({ total: 5, passed: 1, opened: 1, notnew: 1, active: 0, none: 2 });
    expect(R.teamSummary(R.teamRows([{ id: "1", name: "А", at: "t" }, { id: "2", name: "Б" }], []))).toEqual({ total: 2, passed: 0, opened: 0, notnew: 0, active: 1, none: 1 });
  });
});

describe("v125: сервер демо — как этап 44", () => {
  const PEOPLE = [
    { id: "u-m", name: "Мария", surname: "Ким", restaurant: "R", position: "manager", is_admin: false },
    { id: "e-a", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter", is_admin: false },
    { id: "e-v", name: "Вера", surname: "Соколова", restaurant: "R", position: "waiter", is_admin: false },
    { id: "e-f", name: "Фёдор", surname: "Белов", restaurant: "R", position: "waiter", is_admin: false, status: "fired" },
    { id: "u-s", name: "Сергей", surname: "Орлов", restaurant: "R", position: "senior", is_admin: false },
    { id: "u-r", name: "Роман", surname: "", restaurant: "R", position: "owner", is_admin: true },
    { id: "e-p", name: "Ирина", surname: "Ли", restaurant: "P", position: "waiter", is_admin: false },
  ];
  const mkS = () => makeServer({ today: "2026-10-31", rest: "R", people: PEOPLE, tok: { tm: "u-m", ta: "e-a", tv: "e-v", ts: "u-s", tr: "u-r", tp: "e-p" }, sstaff: [], cfg: { shifts: [], staff: [] },
    plan: {}, menu: [], clock: () => NOW });
  const set = (s, t, kind, data) => s.rpc("wine_progress_set", { p_token: t, p_kind: kind, p_data: data });
  it("телефон присылает: без входа — auth, чужой вид — kind, викторина без «из скольких» — quiz и строки нет", () => {
    const s = mkS();
    expect(set(s, "", "opened", {})).toEqual({ ok: false, error: "auth" });
    expect(set(s, "ta", "learned", {})).toEqual({ ok: false, error: "kind" });
    expect(set(s, "ta", "quiz", { quiz: { right: 3 } })).toEqual({ ok: false, error: "quiz" });
    expect(s.S.wine["R|e-a"]).toBeUndefined();
  });
  it("id чистятся (строки, обрезка, до 60 знаков, без повторов), «сколько» не больше «из скольких», без total счёт не пишется", () => {
    const s = mkS();
    expect(set(s, "ta", "opened", { ids: [" w-pro ", "w-pro", 5, "", "x".repeat(70), "w-cha"], stats: { known: 9, total: 4, glassKnown: 2 } })).toEqual({ ok: true });
    const r = s.S.wine["R|e-a"];
    expect(r.opened).toEqual(["w-pro", "x".repeat(60), "w-cha"]);
    expect([r.known, r.total, r.glassKnown, r.glassTotal]).toEqual([4, 4, 2, null]);
    set(s, "ta", "stats", { stats: { known: 1 } });
    expect(r.known).toBe(4);
    set(s, "ta", "quiz", { quiz: { right: 12, of: 10 } });
    expect([r.quizRight, r.quizOf]).toEqual([10, 10]);
    set(s, "ta", "passed", { ids: ["w-pro", "w-cha"] });
    expect(r.passed).toEqual(["w-pro", "w-cha"]);
    expect(r.opened).toEqual(["w-pro", "x".repeat(60), "w-cha"]);
  });
  it("команда: сотруднику — нельзя; руководителю — своё заведение без владельца и уволенных, кто прислал — выше; другое — только сеть", () => {
    const s = mkS();
    set(s, "tv", "passed", { ids: ["w-pro"] });
    expect(s.rpc("wine_progress_team", { p_token: "ta" })).toEqual({ ok: false, error: "forbidden", restaurant: "R" });
    const t = s.rpc("wine_progress_team", { p_token: "tm" });
    expect(t.ok).toBe(true);
    expect(t.rows.map((x) => x.id)).toEqual(["e-v", "e-a", "u-m", "u-s"]);
    expect(t.rows[0]).toMatchObject({ name: "Вера Соколова", pos: "waiter", passed: ["w-pro"], opened: [] });
    expect(t.rows[1]).toMatchObject({ passed: [], known: null, at: null });
    expect(s.rpc("wine_progress_team", { p_token: "tm", p_restaurant: "P" }).error).toBe("forbidden");
    expect(s.rpc("wine_progress_team", { p_token: "ts", p_restaurant: "P" }).rows.map((x) => x.id)).toEqual(["e-p"]);
    expect(s.rpc("wine_progress_team", { p_token: "tr", p_restaurant: "P" }).ok).toBe(true);
  });
});

describe("v125: экран и отчёты", () => {
  const TR = rd("ui/wine-train.jsx"), L = rd("ui/wine-list.jsx");
  const T = { screen: {}, modCard: {}, para: { color: "#ddd" }, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, doneBtn: {} };
  it("телефон сообщает: открыл «Новые вина», выучил, вышел из колоды после отметок, викторина; одно и то же — не дважды", () => {
    for (const s of ["export function wineReport(kind, data, wines, restaurant, sr = null)", 'rpcSync("wine_progress_set", { p_token: saToken(), p_kind: kind, p_data })',
      "if (k === lastReport.k && t - lastReport.t < 3000) return;", 'if (initialOnly === "new" && newIds.length) wineReport("opened", { ids: newIds }, wines, restaurant);',
      'if (marked.current) wineReport("stats", {}, winesRef.current, restaurant);', "markSr(w.id, ok); bumpDaily(uk); marked.current = true;",
      'wineReport("quiz", { quiz: { right: res.right, of: res.total } }, wines, restaurant, sr0);']) expect(TR, s).toContain(s);
    expect(L).toContain('wineReport("passed", { ids: fresh.map((x) => x.id) }, all, restaurant)');
  });
  it("«Кто выучил новые вина»: пункт тренировки только руководителю; нет этапа — что выполнить; отказ и сбой — словами", () => {
    for (const s of ['edit ? row("team", UI_SVG.eye(gold, 19), "Кто выучил новые вина"', 'rpc("wine_progress_team", { p_token: saToken(), p_restaurant: restaurant })',
      'else if (rpcMissing(r)) setRes({ err: "missing" });', "supabase/supabase-stage44-wines.sql</b> в Supabase → SQL Editor", "Сводка доступна руководителю своего заведения.",
      "Не получилось загрузить. Проверь связь и открой ещё раз.", "Новые вина выучены ✓", '"Новые вина: учит, осталось " + r.left + " из " + fresh.length', '"Новые вина не открыты"',
      '"Тренировки по винам пока нет"', "data-wine-team-row={r.id} data-wine-team-state={r.state}", 'const okText = a11y ? "#2F6B45" : green;']) expect(TR, s).toContain(s);
    for (const s of ['["quiz", "pair", "say60", "pron", "team"].includes(key)', 'if (view === "team") return <WineTeam']) expect(L, s).toContain(s);
  });
  it("экран рисуется: до ответа сервера — заготовка строк; в тренировке пункт есть у руководителя и нет у сотрудника", async () => {
    const { WineTeam, WineTrainHub } = await import("../ui/wine-train.jsx");
    const heads = [];
    const html = renderToString(React.createElement(WineTeam, { T, a11y: false, gold: "#C8A96E", green: "#5DBB8A", wines: CARD, restaurant: "R", Head: (t) => { heads.push(t); return null; } }));
    expect(html).toContain('data-wine-team="load"');
    expect(heads).toEqual(["Кто выучил новые вина"]);
    const hub = (edit) => renderToString(React.createElement(WineTrainHub, { T, a11y: false, gold: "#C8A96E", green: "#5DBB8A", wines: CARD, restaurant: "R", edit, onOpen: () => {}, onReview: () => {} }));
    expect(hub(true)).toContain('data-wine-train="team"');
    expect(hub(false)).not.toContain('data-wine-train="team"');
  });
  it("демо: команда учит вина (Анна выучила, Вера и Илья учат, Пётр не открывал); проверка демо — экран команды", () => {
    const B = rd("tools/claude/demo-app/boot.js"), C = rd("tools/claude/demo-app/check.mjs"), F = rd("tools/claude/demo-app/fake-server.js");
    expect(B).toContain("wineProg");
    expect(C).toContain("Кто выучил новые вина");
    for (const s of ['if (fn === "wine_progress_set") return wineSet(p, b);', 'if (fn === "wine_progress_team") return wineTeam(p, b);']) expect(F, s).toContain(s);
  });
  it("README, CHANGES; без тире-ритма и эмодзи в новом коде; метка — v125", () => {
    const TOOLS = rd("tools/claude/README.md");
    expect(TOOLS).toContain("`e2e-v125.mjs` — v125 (Доп. 438)");
    expect(TOOLS).toContain("node tools/claude/pg-check-stage44.mjs");
    expect(rd("CHANGES.md")).toContain("# Дополнение 438 — «Кто выучил новые вина»");
    for (const f of ["ui/wine-train.jsx", "lib/wine-train.js", "ui/wine-list.jsx", "tools/claude/demo-app/fake-server.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(Number((rd("ui/menu-trainer.jsx").match(/· сборка v(\d+)<\/span>/) || [])[1])).toBeGreaterThanOrEqual(125);   // v126: метка дальше
  });
});
