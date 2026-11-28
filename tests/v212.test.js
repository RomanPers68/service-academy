// v212 (Доп. 538): «Позвать» подряд — без «подожди минуту», схема сразу, лист не закрывается.
// Владелец: «Бывает такое, что приходит несколько столов подряд, и хостес должен всех оповестить, а приложение не дает
// это сделать сразу, просит подождать минуту. Да и сам путь, позвать к столу довольно длинный».
//   • этап 68 (supabase-stage68-call-series.sql): не уходит только тот же вызов за 30 секунд (already), предел — 15 за
//     5 минут (too_many); демо-сервер — так же;
//   • lib/call-series.js — тексты листа, кого кнопками, что после ответа, метки «позвали», копия команды и схемы;
//   • ui/call-sheet.jsx — лист (был в ui/chat.jsx), CallLayer — поверх экрана с главной, «Смены» и «Рассадки».
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v212.mjs; этап на базе — tools/claude/sql/test68.sh.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { callAction, sentLine, callHint, againText, callErrText, afterCall, shiftChips, recentCalls, rememberCall, tableMarks, markLine,
  cachedTeam, cachedBoard, cacheAge, keepTeam, keepBoard, freshTeam, freshBoard, prefetchTeam, forgetCalls, RECENT_KEY, CACHE_KEY } from "../lib/call-series.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const memStore = () => {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};
globalThis.localStorage = memStore();
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, head: { appendChild() {} }, getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const fnBody = (sql, name) => { const i = sql.indexOf("create or replace function " + name + "("); return i < 0 ? "" : sql.slice(i, sql.indexOf("end; $$;", i)); };

const ANNA = { who: "person", emp: "e-anna", toName: "Анна Смирнова", why: "table", table: "13" };
const PEOPLE = [
  { id: "e-petr", name: "Пётр Орлов", pos: "waiter", shift: true }, { id: "e-ilya", name: "Илья Белов", pos: "bartender", shift: true },
  { id: "e-anna", name: "Анна Смирнова", pos: "waiter", shift: true }, { id: "u-lead", name: "Мария Ким", pos: "senior", shift: false },
  { id: "e-vera", name: "Вера Соколова", pos: "waiter", shift: false }, { id: "u-host", name: "Ольга Ли", pos: "hostess", shift: true }];
const PLAN = { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], bg: "data:image/jpeg;base64,AAAA",
  tables: [{ id: "t5", n: "5", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t7", n: "7", seats: 4, shape: "sq", x: 2, y: 0, z: "z1" },
    { id: "t13", n: "13", seats: 6, shape: "long", x: 4, y: 0, z: "z1" }] };
const BOARD = { ok: true, floor: 2, lead: false, staff: [{ id: "x" }], wait: [], plan: PLAN, tables: [{ tid: "t5", status: "seat", cnt: 2, since: "2026-11-28T00:00:00Z", waiter_id: "e-anna", waiter_name: "Анна Смирнова" }], now: "2026-11-28T00:30:00Z" };
const ME = { id: "u-host", name: "Ольга Ли", restaurant: "R" };

describe("v212 · версия и журнал", () => {
  it("сборка v212, Дополнение 538 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(212);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 538 — .*\(v212\)/);
    const part = c.slice(c.indexOf("# Дополнение 538"));
    for (const w of ["«Бывает такое, что приходит несколько столов подряд", "supabase-stage68-call-series.sql", "already", "too_many", "ui/call-sheet.jsx",
      "lib/call-series.js", "CallLayer", "test68.sh", "e2e-v212.mjs", "«Занят, передать дальше»"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v212 · этап 68: тот же вызов — раз в 30 секунд, всего — 15 за 5 минут", () => {
  const sql = rd("supabase/supabase-stage68-call-series.sql");
  const f = fnBody(sql, "chat_call");
  it("без этапа 38 — понятная ошибка; права, перезагрузка схемы, итог", () => {
    expect(sql).toContain("raise exception 'Сначала этап 38 (supabase-stage38-chat.sql): нет чата смены';");
    expect(sql).toContain("revoke all on function chat_call(text, text, text, text, text, text) from public;");
    expect(sql).toContain("grant execute on function chat_call(text, text, text, text, text, text) to anon, authenticated;");
    expect(sql).toContain("notify pgrst, 'reload schema';");
    expect(sql).toContain("select 'Позвать подряд: тот же вызов — раз в 30 секунд, всего — 15 за 5 минут · вызовов за сутки: '");
    expect(f).toContain("returns jsonb language plpgsql security definer set search_path to public as $$");
  });
  it("повтор: кого, зачем, стол, свой текст — те же, за 30 секунд, не удалён → already с прошлым вызовом", () => {
    expect(f).toContain("x.emp_id = c->>'id' and x.kind = 'call' and not x.deleted and x.created_at > now() - interval '30 seconds'");
    expect(f).toContain("and x.call->>'who' = p_who and coalesce(x.call->>'emp', '') = emp and x.call->>'why' = p_why");
    expect(f).toContain("and coalesce(x.call->>'table', '') = tbl and coalesce(x.call->>'text', '') = txt");
    expect(f).toContain("return jsonb_build_object('ok', false, 'error', 'already', 'msg', _sa_chat_msg_json(prev));");
    expect(f).not.toContain("'too_fast'");   // полминуты после любого вызова больше нет
  });
  it("лавина: 15 вызовов за 5 минут — too_many и через сколько секунд можно", () => {
    expect(f).toContain("x.emp_id = c->>'id' and x.kind = 'call' and x.created_at > now() - interval '5 minutes';");
    expect(f).toContain("if n >= 15 then");
    expect(f).toContain("'wait', greatest(1, ceil(extract(epoch from (first_at + interval '5 minutes' - now()))))::int);");
  });
  it("остальное — как этап 38: проверки, сообщение в команду, Telegram с «Иду»", () => {
    const old = fnBody(rd("supabase/supabase-stage38-chat.sql"), "chat_call");
    for (const line of ["if p_who is null or p_who not in ('lead', 'host', 'bar', 'waiter', 'person')", "if p_why = 'table' and tbl !~ '^[0-9A-Za-zА-Яа-яЁё]{1,6}$' then",
      "perform _sa_chat_after_write(ch, c->>'id', m.id);", "jsonb_build_object('text', 'Иду', 'callback_data', 'cg:' || m.id)",
      "and (p_who = 'person' or today is null or cardinality(today) = 0 or e.id::text = any(today))", "return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));"]) {
      expect(old, line).toContain(line);
      expect(f, line).toContain(line);
    }
    expect(old).toContain("interval '30 seconds') then\n    return jsonb_build_object('ok', false, 'error', 'too_fast');");   // этап 38 в истории — как был
  });
  it("журнал этапов и папка SQL-проверок знают этап 68", () => {
    expect(rd("supabase/README.md")).toContain("`supabase-stage68-call-series.sql`");
    expect(rd("tools/claude/README.md")).toContain("sql/test68.sh");
    expect(rd("tools/claude/sql/test68.sh")).toContain("S68=supabase-stage68-call-series.sql");
  });
});

describe("v212 · тексты листа", () => {
  it("что уйдёт и что ушло", () => {
    expect(callAction(ANNA)).toBe("Позвать Анну к столу 13");
    expect(sentLine(ANNA)).toBe("Позвали Анну к столу 13");
    expect(callAction({ who: "waiter", why: "table", table: "7" })).toBe("Позвать официанта к столу 7");
    expect(callAction({ who: "lead", why: "help" })).toBe("Позвать менеджера: нужна помощь");
    expect(callAction({ who: "bar", why: "guest" })).toBe("Позвать бар: гость ждёт");
    expect(callAction({ who: "person", toName: "Пётр Орлов", why: "come" })).toBe("Позвать Петра: подойди ко мне");
    expect(callAction({ who: "host", why: "own", text: "принеси детский стульчик к шестому столу и меню" })).toBe("Позвать хостес: принеси детский стульчик к шестому…");
  });
  it("чего не хватает: стол на схеме или номером, кого, свой текст", () => {
    expect(callHint({ why: "table" }, true)).toBe("Выбери стол и кого позвать");
    expect(callHint({ why: "table" }, false)).toBe("Впиши стол и выбери, кого позвать");
    expect(callHint({ who: "waiter", why: "table" }, true)).toBe("Выбери стол на схеме");
    expect(callHint({ who: "waiter", why: "table", table: "5!" }, false)).toBe("Впиши номер стола");
    expect(callHint({ why: "table", table: "5" }, true)).toBe("Выбери, кого позвать");
    expect(callHint({ who: "lead", why: "own", text: " " })).toBe("Напиши, зачем зовёшь");
    expect(callHint({ who: "lead", why: "own", text: "я".repeat(81) })).toBe("Короче, до 80 знаков");
    expect(callHint(ANNA, true)).toBe("");
    expect(callHint({ who: "lead", why: "help" })).toBe("");
  });
  it("уже позвали: ждём ответа; ответили — кто идёт", () => {
    expect(againText({ ...ANNA, table: "7" }, null)).toBe("Анну к столу 7 уже позвали, ждём ответа");
    expect(againText({ ...ANNA, table: "7" }, { call: { going: [{ name: "Анна Смирнова" }] } })).toBe("Анна уже идёт к столу 7");
    expect(againText({ who: "waiter", why: "table", table: "7" }, { call: { going: [{ name: "Анна Смирнова" }, { name: "Пётр Орлов" }] } })).toBe("Анна и Пётр уже идут к столу 7");
    expect(againText({ who: "lead", why: "help" }, { call: { going: [] } })).toBe("Менеджера уже позвали, ждём ответа");
  });
  it("ошибки сервера словами; too_fast — сервер без этапа 68", () => {
    expect(callErrText({ ok: false, error: "too_many", wait: 40 })).toBe("Слишком много вызовов подряд. Следующий можно через 40 секунд.");
    expect(callErrText({ ok: false, error: "too_many", wait: 130 })).toBe("Слишком много вызовов подряд. Следующий можно через 3 минуты.");
    expect(callErrText({ ok: false, error: "too_many", wait: 1 })).toBe("Слишком много вызовов подряд. Следующий можно через 1 секунду.");
    expect(callErrText({ ok: false, error: "too_many" })).toBe("Слишком много вызовов подряд. Подожди пару минут.");
    expect(callErrText({ ok: false, error: "too_fast" })).toBe("Только что был вызов: подожди полминуты.");
    expect(callErrText({ ok: false, error: "net" })).toBe("Нет связи. Попробуй ещё раз.");
    expect(callErrText({ ok: false, error: "bad_request" })).toBe("Не отправилось. Проверь связь и попробуй ещё раз.");
    expect(callErrText(null)).toBe("Не отправилось. Проверь связь и попробуй ещё раз.");
  });
  it("после ответа: позвали — стол и человек сброшены, должность остаётся; уже звали — так же; ошибка — выбор как был", () => {
    const pick = { who: "person", person: { id: "e-anna", name: "Анна Смирнова" }, tid: "t13", table: "13", own: "" };
    const ok = afterCall(pick, ANNA, { ok: true, msg: { id: 5 } });
    expect(ok).toEqual({ done: true, again: false, line: "Позвали Анну к столу 13", pick: { who: "", person: null, tid: null, table: "", own: "" } });
    const role = afterCall({ ...pick, who: "waiter", person: null }, { who: "waiter", why: "table", table: "13" }, { ok: true });
    expect([role.line, role.pick.who, role.pick.tid, role.pick.table]).toEqual(["Позвали официанта к столу 13", "waiter", null, ""]);
    const again = afterCall(pick, ANNA, { ok: false, error: "already", msg: { id: 4, call: { going: [] } } });
    expect([again.done, again.again, again.line, again.pick.who]).toEqual([true, true, "Анну к столу 13 уже позвали, ждём ответа", ""]);
    const bad = afterCall(pick, ANNA, { ok: false, error: "too_many", wait: 20 });
    expect(bad).toEqual({ done: false, again: false, err: "Слишком много вызовов подряд. Следующий можно через 20 секунд.", pick });
  });
});

describe("v212 · «Кого» кнопками", () => {
  it("кто в смене, кроме меня: официанты первыми, потом бар; не в смене — нет", () => {
    const r = shiftChips(PEOPLE, "u-host");
    expect(r.shift).toBe(true);
    expect(r.list.map((p) => p.id + ":" + p.label)).toEqual(["e-anna:Анна С.", "e-petr:Пётр О.", "e-ilya:Илья Б."]);
    expect(r.list[0]).toEqual({ id: "e-anna", name: "Анна Смирнова", pos: "waiter", label: "Анна С." });
  });
  it("графика на сегодня нет — все официанты; одинаковые «Анна С.» — полным именем; пусто — пусто", () => {
    const off = PEOPLE.map((p) => ({ ...p, shift: false }));
    const r = shiftChips([...off, { id: "e-anna2", name: "Анна Сидорова", pos: "waiter", shift: false }], "u-host");
    expect(r.shift).toBe(false);
    expect(r.list.map((p) => p.label)).toEqual(["Анна Сидорова", "Анна Смирнова", "Вера С.", "Пётр О."]);
    expect(shiftChips(null, "x")).toEqual({ shift: false, list: [] });
  });
});

describe("v212 · метки «позвали» на схеме (10 минут, этот телефон)", () => {
  beforeEach(() => { globalThis.localStorage = memStore(); });
  const T0 = Date.parse("2026-11-28T09:00:00Z");
  it("запомнить, прочитать, забыть через 10 минут; чужое заведение — нет; тот же ключ — заменяется", () => {
    rememberCall("R", { key: "11", tid: "t13", table: "13", who: "person", emp: "e-anna", toName: "Анна Смирнова", why: "table", text: "" }, T0);
    rememberCall("R2", { key: "12", tid: "t1", table: "1", who: "waiter", why: "table" }, T0);
    rememberCall("R", { key: "13", tid: null, table: "7", who: "waiter", why: "table" }, T0 + 60e3);
    expect(recentCalls("R", T0 + 120e3).map((x) => x.key)).toEqual(["11", "13"]);
    expect(recentCalls("R", T0 + 10.5 * 60e3).map((x) => x.key)).toEqual(["13"]);
    expect(recentCalls("R", T0 + 12 * 60e3)).toEqual([]);
    rememberCall("R", { key: "11", tid: "t13", table: "13", who: "lead", why: "table" }, T0 + 3 * 60e3);
    expect(recentCalls("R", T0 + 4 * 60e3).map((x) => x.key + ":" + x.who)).toEqual(["13:waiter", "11:lead"]);
    for (let i = 0; i < 40; i++) rememberCall("R", { key: "k" + i, why: "help", who: "lead" }, T0 + 5 * 60e3);
    expect(JSON.parse(localStorage.getItem(RECENT_KEY)).length).toBe(30);
  });
  it("метка у стола: по id, без id — по номеру; не к столу — без метки; позже — поверх", () => {
    const marks = tableMarks([
      { tid: "t13", table: "13", who: "person", toName: "Анна Смирнова", why: "table", at: T0 },
      { tid: null, table: "7", who: "waiter", why: "table", at: T0 + 1 },
      { tid: null, table: "", who: "lead", why: "help", at: T0 + 2 },
      { tid: "t13", table: "13", who: "person", toName: "Пётр Орлов", why: "table", at: T0 + 3 },
      { tid: null, table: "99", who: "waiter", why: "table", at: T0 + 4 }], PLAN);
    expect(marks).toEqual({ t13: { label: "позвали Петра", at: T0 + 3 }, t7: { label: "позвали официанта", at: T0 + 1 } });
    expect(markLine(marks.t13, T0 + 30e3)).toBe("позвали Петра только что");
    expect(markLine(marks.t13, T0 + 150e3)).toBe("позвали Петра 2 мин назад");
    expect(markLine(null)).toBe("");
  });
});

describe("v212 · копия команды и схемы на телефоне", () => {
  beforeEach(() => { globalThis.localStorage = memStore(); });
  it("схема — только со столами и без фото плана; без столов — копия стирается", () => {
    keepBoard("R", BOARD);
    const b = cachedBoard("R");
    expect(Object.keys(b).sort()).toEqual(["now", "ok", "plan", "tables"]);
    expect(Object.keys(b.plan).sort()).toEqual(["items", "tables", "v", "zones"]);
    expect(b.plan.tables.length).toBe(3);
    expect(cacheAge("R", "board")).toBeLessThan(1000);
    expect(cacheAge("R", "team")).toBe(Infinity);
    keepBoard("R", { ok: true, plan: { tables: [] }, tables: [] });
    expect(cachedBoard("R")).toBe(null);
    keepBoard("R", { ok: false, error: "auth" });   // ошибка — копию не трогаем (её и нет)
    expect(cachedBoard("R2")).toBe(null);
  });
  it("свежая схема: доска — в копию; нет схемы или нет этапа 35 — false и копия стёрта; нет связи — null, копия остаётся", async () => {
    expect(await freshBoard({ board: () => Promise.resolve(BOARD) }, "R")).toMatchObject({ ok: true, plan: { tables: PLAN.tables } });
    expect(cachedBoard("R").plan.tables.length).toBe(3);
    expect(await freshBoard({ board: () => Promise.resolve({ ok: false, error: "net" }) }, "R")).toBe(null);
    expect(cachedBoard("R")).not.toBe(null);
    expect(await freshBoard({ board: () => Promise.reject(new Error("x")) }, "R")).toBe(null);
    expect(await freshBoard({ board: () => Promise.resolve({ ok: false, error: "missing" }) }, "R")).toBe(false);
    expect(cachedBoard("R")).toBe(null);
    keepBoard("R", BOARD);
    expect(await freshBoard({ board: () => Promise.resolve({ ok: true, plan: null, tables: [] }) }, "R")).toBe(false);
    expect(cachedBoard("R")).toBe(null);
    expect(await freshBoard({}, "R")).toBe(null);
  });
  it("команда: свежая — в копию; не пришла — null; заранее — не чаще раза в 5 минут; выход стирает всё", async () => {
    let asked = 0;
    const api = { people: () => { asked++; return Promise.resolve({ ok: true, people: PEOPLE }); } };
    expect((await freshTeam(api, "R")).length).toBe(6);
    expect(cachedTeam("R").length).toBe(6);
    expect(await freshTeam({ people: () => Promise.resolve({ ok: false, error: "auth" }) }, "R")).toBe(null);
    expect(cachedTeam("R").length).toBe(6);
    await prefetchTeam(api, "R");
    expect(asked).toBe(1);   // копия свежая — сервер не спрашиваем
    const all = JSON.parse(localStorage.getItem(CACHE_KEY)); all.R.teamAt = Date.now() - 6 * 60e3; localStorage.setItem(CACHE_KEY, JSON.stringify(all));
    await prefetchTeam(api, "R");
    expect(asked).toBe(2);
    keepTeam("R", "не список");
    expect(cachedTeam("R").length).toBe(6);
    rememberCall("R", { key: "1", why: "help", who: "lead" });
    forgetCalls();
    expect([localStorage.getItem(CACHE_KEY), localStorage.getItem(RECENT_KEY)]).toEqual([null, null]);
  });
});

describe("v212 · демо-сервер — как этап 68", () => {
  const P = [{ id: "u-host", name: "Ольга", surname: "Ли", restaurant: "R", position: "hostess" }, { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter" },
    { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: "R", position: "waiter" }, { id: "u-m", name: "Мария", surname: "Ким", restaurant: "R", position: "manager" },
    { id: "e-x", name: "Иван", surname: "Петров", restaurant: "R2", position: "waiter" }];
  let t = Date.parse("2026-11-28T09:00:00");
  const mk = (o = {}) => makeServer({ today: "2026-11-28", clock: () => t, rest: "R", people: P, tok: { th: "u-host", ta: "e-anna", tx: "e-x" }, sstaff: [], cfg: { shifts: [], staff: [] },
    plan: {}, menu: [], cheers: false, ...o });
  const call = (s, args) => s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-anna", p_why: "table", p_table: "13", p_text: null, ...args });
  it("в «Вся команда» своего заведения, без p_chat; разные вызовы подряд — сразу; тот же за 30 секунд — already", () => {
    t = Date.parse("2026-11-28T09:00:00");
    const s = mk();
    const a = call(s, {});
    expect([a.ok, a.msg.chat, a.msg.call.who, a.msg.call.emp, a.msg.call.to_name, a.msg.call.table]).toEqual([true, s.teamOf("R").id, "person", "e-anna", "Анна Смирнова", "13"]);
    expect(call(s, { p_emp: "e-petr", p_table: "7" }).ok).toBe(true);
    expect(call(s, { p_who: "waiter", p_emp: null, p_table: "5" }).ok).toBe(true);
    expect(call(s, { p_who: "lead", p_emp: null, p_why: "help", p_table: null }).ok).toBe(true);
    const again = call(s, {});
    expect([again.ok, again.error, again.msg.id]).toEqual([false, "already", a.msg.id]);
    t += 31000;
    expect(call(s, {}).ok).toBe(true);
    expect(call(s, { p_emp: "e-x" }).error).toBe("bad_request");   // из другого заведения
    expect(call(s, { p_emp: "u-host" }).error).toBe("bad_request");   // себя
  });
  it("15 вызовов за 5 минут — 16-й too_many с ожиданием; без этапа 68 — полминуты после любого", () => {
    t = Date.parse("2026-11-28T10:00:00");
    const s = mk();
    for (let i = 1; i <= 15; i++) { expect(call(s, { p_table: String(i) }).ok, "вызов " + i).toBe(true); t += 1000; }
    const r = call(s, { p_table: "16" });
    expect([r.ok, r.error, r.wait > 280 && r.wait <= 300]).toEqual([false, "too_many", true]);
    const old = mk({ noStage68: true });
    expect(call(old, {}).ok).toBe(true);
    expect(call(old, { p_emp: "e-petr", p_table: "7" }).error).toBe("too_fast");
  });
});

describe("v212 · лист «Позвать» (ui/call-sheet.jsx)", () => {
  beforeEach(() => { globalThis.localStorage = memStore(); });
  const api = { call: () => Promise.resolve({ ok: true }), people: () => new Promise(() => {}), board: () => new Promise(() => {}) };
  it("из копии: сразу «К столу» со схемой, «Кого» — в смене, по должности — официанта первым, кнопка подписана, чего не хватает", async () => {
    const { CallSheet } = await import("../ui/call-sheet.jsx");
    keepTeam("R", PEOPLE); keepBoard("R", BOARD);
    const html = R(h(CallSheet, { me: ME, api, onClose: () => {} }));
    expect(html).toMatch(/role="radio" aria-checked="true" class="ch-chip" data-chat-why="table">К столу</);
    expect(html).toContain("Открываю схему зала…");   // схема грузится частью (Suspense) — в браузере сразу
    expect(html).not.toContain("data-chat-table");
    expect([...html.matchAll(/data-call-person="([^"]+)"[^>]*>([^<]+)</g)].map((m) => m[1] + ":" + m[2])).toEqual(["e-anna:Анна С.", "e-petr:Пётр О.", "e-ilya:Илья Б."]);
    expect(html).toContain('data-call-people="shift"');
    expect([...html.matchAll(/data-chat-who="([a-z]+)">([^<]+)</g)].map((m) => m[1] + ":" + m[2])).toEqual(["waiter:Официанта", "lead:Менеджера", "host:Хостес", "bar:Бар"]);
    expect(html).toMatch(/data-call-more="">Другой…</);
    expect(html).toContain("или всех по должности");
    expect(html).toMatch(/class="ch-main wait" data-chat-call-send="" aria-disabled="true">Выбери стол и кого позвать</);
    expect(html).not.toContain("data-call-last");
  });
  it("стол уже выбран (из «Рассадки») — «Выбери, кого позвать»; копии нет — «Загружаю…», не поле номера", async () => {
    const { CallSheet } = await import("../ui/call-sheet.jsx");
    const empty = R(h(CallSheet, { me: ME, api, onClose: () => {} }));
    expect(empty).toContain('data-call-board-wait="">Загружаю схему зала…');
    expect(empty).toContain("Загружаю, кто в смене…");
    expect(empty).not.toContain("data-chat-table");
    expect(empty).toContain(">по должности<");
    keepTeam("R", PEOPLE); keepBoard("R", BOARD);
    const picked = R(h(CallSheet, { me: ME, api, init: { tid: "t7", table: "7" }, onClose: () => {} }));
    expect(picked).toMatch(/data-chat-call-send="" aria-disabled="true">Выбери, кого позвать</);
  });
  it("схема с метками: колокольчик у стола, «позвали Анну» диктору и под схемой", async () => {
    const { CallTables } = await import("../ui/call-table.jsx");
    const at = Date.now() - 2 * 60e3 - 5000;
    const html = R(h(CallTables, { a11y: false, board: BOARD, tid: "t13", who: "", marks: { t13: { label: "позвали Анну", at } }, onPick() {}, onWaiter() {}, onManual() {} }));
    expect((html.match(/data-table-mark=""/g) || []).length).toBe(1);
    expect(html).toMatch(/data-table="t13"[^>]*aria-label="Стол 13[^"]*, позвали Анну"/);
    expect(html).toMatch(/data-call-picked-mark=""[^>]*> · позвали Анну 2 мин назад</);
    expect(R(h(CallTables, { a11y: false, board: BOARD, tid: null, who: "", onPick() {}, onWaiter() {}, onManual() {} }))).not.toContain("data-table-mark");
  });
  it("в коде листа: серия (лист не закрывается), «уже позвали», метки, кнопка внизу, onSent и onClose(n)", () => {
    const s = rd("ui/call-sheet.jsx");
    expect(s).toContain("const res = afterCall({ who, person, tid, table, own }, c, r);");
    expect(s).toContain("if (!res.done) { setErr(res.err); return; }");
    expect(s).toContain("rememberCall(rest, { key, tid: c.why === \"table\" ? tid : null, table: c.table, who: c.who, emp: c.emp || null, toName: c.toName || \"\", why: c.why, text: c.text });");
    expect(s).toContain("if (!res.again) { setCount((k) => k + 1); vibrate(\"success\"); if (onSent) onSent(msg); }");
    expect(s).toContain("const close = () => { if (onClose) onClose(count); };");
    expect(s).toContain('<div className="ch-cs-body sa-dlgscroll" data-call-body="">');
    expect(s).toContain('<div className="ch-cs-foot">');
    expect(s).toContain("if (busyRef.current) return;");   // двойное нажатие — один вызов
    // сверху вниз: схема, «Кого», «Зачем» — схема и люди без прокрутки
    expect(s.indexOf("<CallTables a11y={a11y}")).toBeLessThan(s.indexOf('data-call-people={chips.shift ? "shift" : "waiters"}'));
    expect(s.indexOf('data-call-people={chips.shift ? "shift" : "waiters"}')).toBeLessThan(s.indexOf('aria-label="Зачем" data-call-why=""'));
    expect(s).not.toContain("onDone");
    const css = rd("ui/chat.jsx");
    for (const r of [".ch-sheet.ch-cs{display:flex;flex-direction:column;overflow:hidden}", ".ch-cs-body{flex:1 1 auto;min-height:0;overflow-y:auto;",
      ".ch-cs-foot{flex:0 0 auto;", ".ch-main.wait{opacity:.62;box-shadow:none}", ".ch-cs-last{display:flex;"]) expect(css, r).toContain(r);
  });
});

describe("v212 · откуда позвать", () => {
  it("чат: колокольчик в переписке — вызовы в ленту, лист открыт; из списка — после вызовов в «Вся команда»", () => {
    const s = rd("ui/chat.jsx");
    expect(s).toContain('import { CallSheet } from "./call-sheet";');
    expect(s).toContain("onSent={(msg) => { if (msg) { stick.current = true; addMsgs([msg], { quiet: true }); heat(); } }} /> : null}");
    expect(s).toContain("onClose={(n) => { setCallOpen(false); if (n) setCurId(team.id); }} /> : null}");
    expect(s).toContain("export function CallLayer({ a11y, me, api, init = null, onClose }) {");
    expect(s).toContain('<div ref={rootRef} className={"sa-dlg ch" + (a11y ? " lt" : "") + (kb.up ? " kb" : "")} data-call-layer="" style={{ background: "none" }}>');
    expect(s).not.toContain("function CallSheet(");
  });
  it("App: слой поверх экрана, хостес — главная и «Смена», «Рассадка» — у всех; копия схемы и команды заранее; выход стирает", () => {
    const a = rd("App.jsx");
    expect(a).toContain('const CallLayer = lazy(() => retryImport(() => import("./ui/chat")).then(m => ({ default: m.CallLayer })));');
    expect(a).toContain('const callHost = callOn && shiftRoleOf(profile) === "host";');
    expect(a).toContain("{callLayer && chatMe && chatOpen == null ? <Suspense fallback={null}><CallLayer a11y={a11y} me={chatMe} api={chatApiObj} init={callLayer}");
    expect(a).toContain('callRow={callHost && !(shiftToday && shiftToday.off) ? { key: "call", label: "Позвать:", title: "официанта к столу", onClick: () => openCall(null) } : null}');
    expect(a).toContain('onBack={() => goBack("shift")} onCall={callOn ? openCall : null} /></Suspense></div>}');
    expect(a).toContain("if (r && r.ok) keepBoard(profile.restaurant, r);");
    expect(a).toContain("const t = setTimeout(() => { prefetchTeam(chatApiObj, profile.restaurant); }, 2500);");
    expect(a).toContain("forgetCalls();");
    const rs = rd("ui/screens-roleselect.jsx");
    expect(rs).toContain('const callOk = callRow && !(ctx && (ctx.mode === "after" || ctx.mode === "reply"));');
    expect(rs).toContain("const pre = [lateRow && !firstDay ? lateRow : null, callOk ? callRow : null].filter(Boolean);");
    expect(rs).toContain("const rows = pre.length ? [...pre, ...rows0].slice(0, 3) : rows0;");
  });
  it("«Рассадка»: «Позвать» в шапке и «Позвать к столу N» в карточке стола; схема — в копию", () => {
    const s = rd("ui/seating.jsx");
    expect(s).toContain("export function SeatingScreen({ T, a11y, profile, onBack, onMissing, onCall = null }) {");
    expect(s).toContain('{onCall && !edit && ok ? <button type="button" data-seat-call="" onClick={() => { vibrate("light"); onCall(null); }}');
    expect(s).toContain("onCall={onCall ? (q) => { setSel(null); onCall({ tid: q.id, table: String(q.n) }); } : null} /> : null}");
    expect(s).toContain('{onCall ? <button type="button" data-sheet-call="" onClick={() => { vibrate("light"); onCall(t); }}');
    expect(s).toContain("keepBoard(restaurant, r); rememberSeatPlan(restaurant, r); }");
  });
  it("«Смена» у хостес: «Позвать к столу» в карточке зала (не открывает «Рассадку»); схемы нет — отдельной карточкой", async () => {
    const { ShiftRoleCard } = await import("../ui/shift-role.jsx");
    const card = { role: "host", hall: { total: 10, free: 4, seat: 5, bill: 1, clean: 0, res: 0, guests: 14 }, res: null };
    const host = R(h(ShiftRoleCard, { a11y: false, card, onSeat() {}, onCall() {} }));
    expect(host).toContain('data-shift-role="host"');
    expect(host).toMatch(/data-role-call=""[^>]*>.*Позвать к столу<\/button>/);
    expect(R(h(ShiftRoleCard, { a11y: false, card, onSeat() {} }))).not.toContain("data-role-call");
    const alone = R(h(ShiftRoleCard, { a11y: false, card: null, onCall() {} }));
    expect(alone).toContain('data-shift-role="call"');
    expect(alone).toContain("Официанта, менеджера или бар: вызов уходит сразу");
    expect(R(h(ShiftRoleCard, { a11y: false, card: null }))).toBe("");
    expect(rd("ui/shift-role.jsx")).toContain("const call = (e) => { if (e && e.stopPropagation) e.stopPropagation(); vibrate(\"light\"); if (onCall) onCall(); };");
  });
});

describe("v212 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["ui/call-sheet.jsx", "lib/call-series.js", "ui/call-table.jsx", "ui/shift-role.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect([f, /\p{Extended_Pictographic}/u.test(src)]).toEqual([f, false]);
    }
  });
});
