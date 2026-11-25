// v198 (Доп. 523): заведения и должности — свои списки у владельца, а не в коде. Владелец (26.11): «Нужно добавить
// возможность добавлять заведения. И исключить привязанные. И что бы заведения появлялись после добавления в
// приложение… Так же нужно добавить возможность добавлять сотрудников, имею ввиду должность». Решили: начать с пустого
// списка, но ничего не удалять («Ну естественно не чистить полностью😉»), «Два моря, Океан» оставить («это заведение
// использует приложение»), править — только владелец.
//   1. Сервер — этап 61 (supabase/supabase-stage61-places.sql, проверка tools/claude/sql/test61.sh): sa_venues,
//      sa_positions, employees.job_title; org_lists, org_venue_save, org_position_save, admin_employee_place,
//      admin_create_employee_t;
//   2. lib/org-model.js — разбор, выбор, подписи и те же правила для демо; lib/org.js — кэш, запрос, вход «Демо»;
//   3. ui/org.jsx — экран «Заведения и должности», окно «+ Заведение» и «+ Должность», ряды выбора с «+»;
//      «Команда»: «+» в форме, перевод в карточке, подписи своих должностей; меню и концепция — из списка;
//   4. сервер демо (tools/claude/demo-app/fake-server.js) — этап 61 по тем же правилам; «Сервер» знает этап 61.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v198.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { orgFallback, normOrg, venueNames, hiddenVenues, venuesWithMine, pickPositions, hiddenPositions, titleOf, titleIdOf, baseLabel,
  venueOp, positionOp, orgSeed, doneText, orgErr, cleanName, BASES, BASE_HINT } from "../lib/org-model.js";
import { orgNow, loadOrg, saveVenue, savePosition, placeEmployee, _resetOrg } from "../lib/org.js";
import { OrgScreen, ChipRow } from "../ui/org.jsx";
import { S } from "../ui/styles";
import { STAGES } from "../lib/server-check.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const FIVE = ["Два моря, Океан", "Марико", "Мясник", "Порт", "Камчадал"];
// ответ сервера после этапа 61 (первый запуск) — как org_lists у владельца
const SRV = () => ({ ok: true, can_edit: true,
  venues: [{ name: "Два моря, Океан", hidden: false, sort: 0, staff: 9 }, ...FIVE.slice(1).map((name, i) => ({ name, hidden: true, sort: i + 1, staff: name === "Порт" ? 2 : 0 }))],
  positions: [["waiter", "Официант"], ["hostess", "Хостес"], ["bartender", "Бармен"], ["senior_bartender", "Старший бармен"], ["manager", "Менеджер"], ["senior", "Руководящий состав"]]
    .map(([id, label], i) => ({ id, label, base: id, builtin: true, hidden: false, sort: i, staff: 1 })),
  titles: {}, me: { restaurant: "Два моря, Океан", position: "owner", title: null } });

describe("v198 · версия и журнал", () => {
  it("сборка v198, Дополнение 523 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(198);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 523 — .*\(v198\)/);
    const part = c.slice(c.indexOf("# Дополнение 523"));
    expect(part).toContain("«Нужно добавить возможность добавлять заведения. И исключить привязанные.");
    expect(part).toContain("«Ну естественно не чистить полностью😉»");
    expect(part).toContain("«Два моря, океан нужно оставить, так как это заведение использует приложение»");
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v198 · списки: запасной, с сервера, выбор", () => {
  it("пока этапа 61 нет — как до v198: пять заведений и шесть должностей из data/", () => {
    const o = orgFallback();
    expect(o.stage).toBe(false);
    expect(venueNames(o)).toEqual(FIVE);
    expect(pickPositions(o).map((p) => p.id)).toEqual(["waiter", "hostess", "bartender", "senior_bartender", "manager", "senior"]);
    expect(o.canEdit).toBe(false);
  });
  it("ответ сервера: в списке «Два моря, Океан», четыре скрыты; не тот ответ — null; мусор отброшен", () => {
    const o = normOrg(SRV());
    expect(o.stage).toBe(true);
    expect(venueNames(o)).toEqual(["Два моря, Океан"]);
    expect(hiddenVenues(o).map((v) => v.name)).toEqual(["Марико", "Мясник", "Порт", "Камчадал"]);
    expect(o.venues.find((v) => v.name === "Порт").staff).toBe(2);
    expect(normOrg({ ok: false, error: "auth" })).toBe(null);
    expect(normOrg({ ok: true, venues: [] })).toBe(null);
    const bad = normOrg({ ok: true, venues: [{ name: "  " }, { name: 5 }, { name: "Алёнка" }], positions: [{ id: "x", label: "Повар", base: "chef" }, { id: "p1", label: "Бариста", base: "bartender" }],
      titles: { a: "p1", b: 7 }, me: { title: "" } });
    expect(bad.venues.map((v) => v.name)).toEqual(["Алёнка"]);
    expect(bad.positions.map((p) => p.id)).toEqual(["p1"]);
    expect(bad.titles).toEqual({ a: "p1" });
    expect(bad.me).toEqual({ title: null });
  });
  it("меню и концепция: видимые и своё заведение — всегда, даже скрытое (первым)", () => {
    const o = normOrg(SRV());
    expect(venuesWithMine(o, "Два моря, Океан")).toEqual(["Два моря, Океан"]);
    expect(venuesWithMine(o, "Порт")).toEqual(["Порт", "Два моря, Океан"]);
    expect(venuesWithMine(o, "")).toEqual(["Два моря, Океан"]);
  });
  it("подпись должности: своя — по job_title или по titles, встроенная — из списка (владелец переименовал), иначе словарь", () => {
    const o = normOrg({ ...SRV(), positions: [...SRV().positions.map((p) => (p.id === "senior" ? { ...p, label: "Руководство" } : p)),
      { id: "pab12cd34", label: "Бариста", base: "bartender", builtin: false, hidden: false, sort: 6 }], titles: { "e-2": "pab12cd34" } });
    expect(titleOf(o, { id: "e-1", position: "bartender", job_title: "pab12cd34" })).toBe("Бариста");
    expect(titleOf(o, { id: "e-2", position: "bartender" })).toBe("Бариста");
    expect(titleOf(o, { id: "e-3", position: "senior" })).toBe("Руководство");
    expect(titleOf(o, { id: "e-4", position: "owner" })).toBe("Владелец");
    expect(titleOf(o, { id: "e-5", position: "waiter", job_title: "pнет" })).toBe("Официант");
    expect(titleIdOf(o, { id: "e-2", position: "bartender" })).toBe("pab12cd34");
    expect(titleIdOf(o, { id: "e-3", position: "Manager" })).toBe("manager");
    expect(baseLabel(o, "senior")).toBe("Руководство");
  });
  it("«работает как» — шесть встроенных, у каждой подсказка, что она даёт", () => {
    expect(BASES).toEqual(["waiter", "hostess", "bartender", "senior_bartender", "manager", "senior"]);
    for (const b of BASES) expect(BASE_HINT[b], b).toMatch(/курс «/);
    expect(BASE_HINT.bartender).toBe("Права сотрудника зала, курс «Бар», чат бара");
  });
});

describe("v198 · правила этапа 61 (для демо и проверок)", () => {
  it("заведение: добавить (пробелы чистятся), то же название у скрытого — вернуть, у видимого — «уже есть»", () => {
    const st = orgSeed();
    expect(venueNames(st)).toEqual(["Два моря, Океан"]);
    expect(venueOp(st, { newName: "  Алёнка  " })).toEqual({ ok: true, done: "added", name: "Алёнка" });
    expect(venueNames(st)).toEqual(["Два моря, Океан", "Алёнка"]);
    expect(venueOp(st, { newName: " порт " })).toEqual({ ok: true, done: "returned", name: "Порт" });
    expect(venueOp(st, { newName: "АЛЁНКА" })).toEqual({ ok: true, done: "exists", name: "Алёнка" });
    expect(st.venues.filter((v) => v.name.toLowerCase() === "алёнка").length).toBe(1);
  });
  it("заведение: переименовать (в занятое — нельзя), скрыть, вернуть; ошибки как у сервера", () => {
    const st = orgSeed();
    venueOp(st, { newName: "Алёнка" });
    expect(venueOp(st, { name: "Порт", newName: "Порт  Камчатка" })).toEqual({ ok: true, done: "renamed", name: "Порт Камчатка", from: "Порт" });
    expect(venueOp(st, { name: "Порт Камчатка", newName: "алёнка" })).toEqual({ ok: false, error: "exists", name: "Алёнка" });
    expect(venueOp(st, { name: "Алёнка", hidden: true })).toEqual({ ok: true, done: "hidden", name: "Алёнка" });
    expect(venueOp(st, { name: "Алёнка", hidden: false }).done).toBe("returned");
    expect(venueOp(st, { newName: "   " }).error).toBe("bad_request");
    expect(venueOp(st, { newName: "я".repeat(61) }).error).toBe("too_long");
    expect(venueOp(st, { name: "Нет такого", newName: "Новое" }).error).toBe("not_found");
  });
  it("должность: добавить с «работает как», такая же — «уже есть», скрытая — вернуть; у встроенной права не меняются", () => {
    const st = orgSeed();
    const r = positionOp(st, { label: "Бариста", base: "bartender" }, "pab12cd34");
    expect(r).toEqual({ ok: true, done: "added", id: "pab12cd34" });
    expect(positionOp(st, { label: "бариста", base: "waiter" })).toEqual({ ok: false, error: "exists", id: "pab12cd34" });
    expect(positionOp(st, { label: "Сомелье", base: "chef" }).error).toBe("bad_base");
    expect(positionOp(st, { label: "", base: "waiter" }).error).toBe("bad_request");
    expect(positionOp(st, { id: "waiter", base: "manager" }).error).toBe("builtin");
    expect(positionOp(st, { id: "senior", label: "Руководство" }).done).toBe("renamed");
    expect(positionOp(st, { id: "pab12cd34", base: "waiter" }).done).toBe("based");
    expect(positionOp(st, { id: "pab12cd34", hidden: true }).done).toBe("hidden");
    expect(hiddenPositions(st).map((p) => p.label)).toEqual(["Бариста"]);
    expect(positionOp(st, { label: "Бариста", base: "bartender" })).toEqual({ ok: true, done: "returned", id: "pab12cd34" });
  });
  it("первый запуск: «Два моря, Океан» видно, прежние и названия сотрудников — скрыты", () => {
    const st = orgSeed(["Два моря, Океан", "Кафе у моря"]);
    expect(venueNames(st)).toEqual(["Два моря, Океан"]);
    expect(hiddenVenues(st).map((v) => v.name)).toEqual(["Марико", "Мясник", "Порт", "Камчадал", "Кафе у моря"]);
  });
  it("тексты: что сделано и что не так", () => {
    expect(doneText("venue", { ok: true, done: "added", name: "Алёнка" })).toBe("Заведение «Алёнка» добавлено: уже есть в меню и в выборе.");
    expect(doneText("venue", { ok: true, done: "returned", name: "Порт" })).toBe("«Порт» снова в списке: сотрудники, меню и история на месте.");
    expect(doneText("position", { ok: true, done: "based" })).toBe("Права и курс поменялись у всех, у кого эта должность.");
    expect(orgErr("forbidden")).toBe("Списки меняет только владелец.");
    expect(orgErr("stage")).toBe("Нужен этап базы 61: подскажет экран «Сервер».");
    expect(orgErr("что-то")).toBe("Нет связи. Попробуй ещё раз.");
    expect(cleanName("  Два  моря,   Океан ")).toBe("Два моря, Океан");
  });
});

describe("v198 · вход «Демо»: списки в памяти по тем же правилам", () => {
  beforeEach(() => { _resetOrg(); });
  it("до запроса — запасной список; после — как после этапа 61, добавить и перевести можно", async () => {
    expect(orgNow().stage).toBe(false);
    const o = await loadOrg();
    expect(o.stage).toBe(true);
    expect(venueNames(o)).toEqual(["Два моря, Океан"]);
    const r = await saveVenue({ newName: "Алёнка" });
    expect(r.done).toBe("added");
    expect(venueNames(orgNow())).toEqual(["Два моря, Океан", "Алёнка"]);
    const p = await savePosition({ label: "Бариста", base: "bartender" });
    expect(p.done).toBe("added");
    expect(pickPositions(orgNow()).map((x) => x.label)).toContain("Бариста");
    const m = await placeEmployee("e-1", "Алёнка", p.id);
    expect(m).toEqual({ ok: true, employee: { id: "e-1", restaurant: "Алёнка", position: "bartender", job_title: p.id } });
  });
});

describe("v198 · экран «Заведения и должности» и ряды выбора", () => {
  it("видимые с числом людей и «Изменить», «Скрыть»; скрытые свёрнуты: «Скрытые · 4»; должности — встроенные и свои", () => {
    const o = normOrg({ ...SRV(), positions: [...SRV().positions, { id: "pab12cd34", label: "Бариста", base: "bartender", builtin: false, hidden: false, sort: 6, staff: 0 }] });
    const html = R(h(OrgScreen, { T: S, a11y: false, org: o, onBack: () => {} }));
    expect(html).toContain("Заведения и должности");
    expect(html).toContain("Что добавишь, сразу появится в меню, в выборе у новых сотрудников и в концепции.");
    expect(html).toContain("Два моря, Океан");
    expect(html).toContain("9 сотрудников");
    expect(html).toContain('data-org-rename="Два моря, Океан"');
    expect(html).toContain('data-org-hide="Два моря, Океан"');
    expect(html).toContain("▸ Скрытые · 4");
    expect(html).not.toContain('data-org-unhide="Порт"');   // свёрнуто
    expect(html).toContain("Бариста");
    expect(html).toContain("как бармен · пока никого");
    expect(html).toContain("встроенная · 1 сотрудник");
    expect(html).toContain('data-org-open="venue"');
    expect(html).toContain('data-org-open="position"');
    expect(html).not.toContain("data-org-nostage");
  });
  it("без этапа 61: списки из приложения, править нельзя, подсказка про этап", () => {
    const html = R(h(OrgScreen, { T: S, a11y: false, org: orgFallback(), onBack: () => {} }));
    expect(html).toContain("data-org-nostage");
    expect(html).toContain("Чтобы их менять, нужен этап базы 61: файл supabase-stage61-places.sql один раз запустить в Supabase.");
    expect(html).not.toContain("data-org-open");
    expect(html).not.toContain("data-org-hide");
    for (const n of FIVE) expect(html).toContain(n);
  });
  it("ряд выбора: выбранное отмечено, пунктирный «+» — только если передан", () => {
    const items = [{ id: "Два моря, Океан", label: "Два моря, Океан" }, { id: "Алёнка", label: "Алёнка" }];
    const on = R(h(ChipRow, { a11y: false, items, value: "Алёнка", onPick: () => {}, add: { kind: "venue", label: "Заведение", onClick: () => {} }, attr: "data-team-venue" }));
    expect(on).toContain('data-team-venue="Алёнка" class="sa-btn sa-chip-on"');
    expect(on).toContain('data-org-add="venue"');
    expect(on).toContain(">+</span>Заведение");
    const off = R(h(ChipRow, { a11y: false, items, value: "Алёнка", onPick: () => {} }));
    expect(off).not.toContain("data-org-add");
  });
});

describe("v198 · где списки берутся", () => {
  it("«Команда»: форма и перевод из списков, «+» у владельца с этапом 61, экран «Заведения и должности», подписи своих должностей", () => {
    const t = rd("ui/screens-team.jsx");
    expect(t).toContain('const canOrg = isOwner && org.stage && org.canEdit;');
    expect(t).toContain("const formVenues = isOwner ? venueNames(org) : venuesWithMine(org, profile?.restaurant);");
    expect(t).toContain('add={canOrg ? { kind: "venue", label: "Заведение"');
    expect(t).toContain('add={canOrg ? { kind: "position", label: "Должность"');
    expect(t).toContain("const res = await createEmployee({ token, name: form.name, surname: form.surname, restaurant: formRest, title: formPos });");
    expect(t).toContain("const r = await placeEmployee(selected.id, place.restaurant, place.title);");
    expect(t).toContain('if (view === "org") {');
    expect(t).toContain("{titleOf(org, e)} · {ago(e.last_seen_at)}");
    expect(t).not.toContain('rpc("admin_create_employee"');
    expect(t).not.toMatch(/RESTAURANTS\.map\(r =>/);
  });
  it("меню и концепция: заведения из списка владельца, своё — всегда", () => {
    const m = rd("ui/menu-trainer.jsx");
    expect(m).toContain("const venues = venuesWithMine(org, profile?.restaurant);");
    expect(m).not.toContain("RESTAURANTS");
    const c = rd("ui/concept.jsx");
    expect(c).not.toContain("RESTAURANTS");
    expect(c).toContain("const hiddenSet = new Set(hiddenVenues(org).map((v) => v.name));");
  });
  it("«Сервер» знает этап 61 по org_lists", () => {
    expect(STAGES.find((s) => s.n === "61")).toEqual({ n: "61", file: "supabase-stage61-places.sql", what: "Заведения и должности: свои списки у владельца, перевод сотрудника", fn: "org_lists" });
  });
});

describe("v198 · сервер: этап 61", () => {
  const sql = rd("supabase/supabase-stage61-places.sql");
  it("первый запуск: «Два моря, Океан» видно, четыре скрыты; названия из employees — скрытыми; шесть встроенных должностей", () => {
    expect(sql).toContain("('Два моря, Океан', false, 0, 'этап 61'), ('Марико', true, 1, 'этап 61'), ('Мясник', true, 2, 'этап 61'),");
    expect(sql).toContain("('Порт', true, 3, 'этап 61'), ('Камчадал', true, 4, 'этап 61')");
    expect(sql).toContain("if not exists (select 1 from sa_venues) then");
    expect(sql).toContain("select distinct e.restaurant, true, 10, 'этап 61' from employees e");
    expect(sql).toContain("alter table employees add column if not exists job_title text;");
    expect(sql).toContain("check (base in ('waiter', 'hostess', 'bartender', 'senior_bartender', 'manager', 'senior'))");
  });
  it("править — только владелец; таблицы закрыты; переименование — во всех таблицах с restaurant", () => {
    expect((sql.match(/if not coalesce\(\(c->>'admin'\)::boolean, false\) then return jsonb_build_object\('ok', false, 'error', 'forbidden'\); end if;/g) || []).length).toBe(3);
    expect(sql).toContain("revoke all on table sa_venues from public, anon, authenticated;");
    expect(sql).toContain("revoke all on table sa_positions from public, anon, authenticated;");
    expect(sql).toContain("and col.column_name in ('restaurant', 'emp_rest')");
    expect(sql).toContain("exception when unique_violation then");
    expect(sql).toContain("update employees set position = v_base where job_title = v_row.id;");
  });
  it("новый сотрудник — через прежнюю функцию, параметры именами; итог для владельца", () => {
    expect(sql).toContain("execute format('select to_jsonb(admin_create_employee(p_token => %L, p_name => %L, p_surname => %L, p_restaurant => %L, p_position => %L))',");
    expect(sql).toContain("'заведения и должности: функций '");
    const t = rd("tools/claude/sql/test61.sh");
    expect(t).toContain("bash run25.sh && bash test61.sh");
    expect((t.match(/^chk "/gm) || []).length).toBe(50);
    expect(rd("supabase/README.md")).toContain("| 70 | `supabase-stage61-places.sql` | **Заведения и должности: свои списки у владельца** (v198)");
  });
});

describe("v198 · сервер демо: этап 61 по тем же правилам", () => {
  const mk = (o = {}) => makeServer({ today: "2026-11-26", rest: "Два моря, Океан", sstaff: [], cfg: null, ...o,
    people: [{ id: "u-roman", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "owner", is_admin: true },
      { id: "u-maria", name: "Мария", surname: "Ким", restaurant: "Два моря, Океан", position: "manager", is_admin: false },
      { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false }],
    tok: { R: "u-roman", M: "u-maria", A: "e-anna" } });
  it("списки, «+», новый сотрудник со своей должностью, перевод, переименование — у всех сразу", () => {
    const s = mk();
    expect(s.rpc("org_lists", { p_token: "A" }).venues.filter((v) => !v.hidden).map((v) => v.name)).toEqual(["Два моря, Океан"]);
    expect(s.rpc("org_venue_save", { p_token: "M", p_name: null, p_new: "Алёнка" })).toEqual({ ok: false, error: "forbidden" });
    expect(s.rpc("org_venue_save", { p_token: "R", p_name: null, p_new: "Алёнка" }).done).toBe("added");
    const pos = s.rpc("org_position_save", { p_token: "R", p_id: null, p_label: "Бариста", p_base: "bartender" });
    expect(pos.done).toBe("added");
    const c = s.rpc("admin_create_employee_t", { p_token: "M", p_name: "Кира", p_surname: "Новикова", p_restaurant: "Алёнка", p_title: pos.id });
    expect(c.ok).toBe(true);
    expect(c.job_title).toBe(pos.id);
    expect(s.rpc("admin_employee_place", { p_token: "R", p_employee_id: "e-anna", p_restaurant: "Алёнка", p_title: pos.id }).employee).toEqual({ id: "e-anna", restaurant: "Алёнка", position: "bartender", job_title: pos.id });
    expect(s.rpc("org_lists", { p_token: "A" }).me).toEqual({ restaurant: "Алёнка", position: "bartender", title: pos.id });
    expect(s.rpc("org_venue_save", { p_token: "R", p_name: "Алёнка", p_new: "Алёнка Центр" }).done).toBe("renamed");
    const team = s.rpc("admin_list_employees", { p_token: "R" });
    expect(team.filter((e) => e.restaurant === "Алёнка Центр").map((e) => e.name).sort()).toEqual(["Анна", "Кира"]);
  });
  it("без этапа 61 — «функции нет», прежнее создание работает", () => {
    const s = mk({ noStage61: true });
    expect(s.rpc("org_lists", { p_token: "R" }).code).toBe("PGRST202");
    expect(s.rpc("admin_create_employee", { p_token: "R", p_name: "Ия", p_surname: "", p_restaurant: "Марико", p_position: "waiter" }).ok).toBe(true);
  });
});
