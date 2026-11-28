// v221 (Доп. 547): «Утро руководителя» менеджеру — только в дни его смен по графику (этап 75). Управляющему, директору и
// владельцу — каждый день, как раньше; каждый может выбрать сам («Каждый день» / «Только в мои смены»); кого нет в
// графике месяца — каждый день. Подписи — lib/morning.js, экран — ui/morning.jsx, сервер — этап 75, демо — так же.
// На локальной базе: tools/claude/sql/test75.sh; в браузере: tools/claude/e2e-v221.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { MORNING_DAYS, morningHasDays, morningPrefsLine, morningShiftNote } from "../lib/morning.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");
const S75 = rd("supabase/supabase-stage75-morning-shift.sql"), S40 = rd("supabase/supabase-stage40-morning.sql");
const fnOf = (sql, name) => { const i = sql.indexOf("create or replace function " + name + "("); return i < 0 ? "" : sql.slice(i, sql.indexOf("end; $$;", i) + 8); };

describe("v221 · версия и журнал", () => {
  it("сборка v221, Дополнение 547, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(221);
    const c = rd("CHANGES.md"), part = c.slice(c.indexOf("# Дополнение 547"));
    expect(part).toMatch(/^# Дополнение 547 — .*\(v221\)/);
    for (const w of ["«Каждый день»", "«Только в мои смены»", "supabase-stage75-morning-shift.sql", "test75.sh", "e2e-v221.mjs"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
  it("в описаниях: этап 75 в таблице и заметке supabase/README.md, проверки в tools/claude/README.md", () => {
    const R = rd("supabase/README.md");
    expect(R).toContain("| 84 | `supabase-stage75-morning-shift.sql` |");
    expect(R).toContain("**если перезапускаешь этап 40 — после него снова этап 75**");
    expect(R).toContain("**Этап 75** (`supabase-stage75-morning-shift.sql`, v221)");
    const T = rd("tools/claude/README.md");
    expect(T).toContain("- `sql/test75.sh` — v221 (Доп. 547)");
    expect(T).toContain("- `e2e-v221.mjs` — v221 (Доп. 547)");
    expect((rd("tools/claude/sql/test75.sh").match(/(^|;\s*)chk "/gm) || []).length).toBe(27);
  });
});

describe("v221 · подписи (lib/morning.js)", () => {
  it("выбор: «Каждый день» и «Только в мои смены»; у старого сервера выбора нет", () => {
    expect(MORNING_DAYS).toEqual([[false, "Каждый день"], [true, "Только в мои смены"]]);
    expect([morningHasDays(null), morningHasDays({ on: true, hour: 9 }), morningHasDays({ shift: false }), morningHasDays({ shift: true }), morningHasDays({ shift: "true" })])
      .toEqual([false, false, true, true, false]);
  });
  it("подпись: каждый день, в дни смен, выключено; старый сервер — как раньше", () => {
    expect(morningPrefsLine({ on: true, hour: 9 })).toBe("Каждое утро в 9:00 по часам заведения");
    expect(morningPrefsLine({ on: true, hour: 10, shift: false })).toBe("Каждое утро в 10:00 по часам заведения");
    expect(morningPrefsLine({ on: true, hour: 10, shift: true, today: "off" })).toBe("В дни твоих смен по графику, в 10:00 по часам заведения");
    expect(morningPrefsLine({ on: false, hour: 10, shift: true })).toBe("Выключено: сводка только здесь");
    expect(morningPrefsLine(null)).toBe("Выключено: сводка только здесь");
    expect([morningPrefsLine({ on: true, hour: 6 }), morningPrefsLine({ on: true, hour: "мусор" }), morningPrefsLine({ on: true })])
      .toEqual(["Каждое утро в 6:00 по часам заведения", "Каждое утро в 9:00 по часам заведения", "Каждое утро в 9:00 по часам заведения"]);
  });
  it("пояснение только при «Только в мои смены»: выходной, отпуск, нет в графике; сегодня смена — пусто", () => {
    const on = (today) => morningShiftNote({ on: true, hour: 9, shift: true, today });
    expect(on("off")).toBe("Сегодня по графику выходной: в Telegram сводка не придёт.");
    expect(on("vac")).toBe("Сегодня по графику отпуск: в Telegram сводка не придёт.");
    expect([on(""), on(undefined), on("мусор")]).toEqual(Array(3).fill("Тебя нет в графике этого месяца, поэтому пока сводка приходит каждый день."));
    expect(on("shift")).toBe("");
    expect([morningShiftNote({ on: true, shift: false, today: "off" }), morningShiftNote({ on: false, shift: true, today: "off" }), morningShiftNote({ on: true, today: "off" }), morningShiftNote(null)])
      .toEqual(["", "", "", ""]);
  });
  it("слова без тире между словами, без «!» и эмодзи", () => {
    for (const t of [...MORNING_DAYS.map((x) => x[1]), morningPrefsLine({ on: true, hour: 9, shift: true }), ...["off", "vac", ""].map((d) => morningShiftNote({ on: true, shift: true, today: d }))]) {
      expect(t, t).not.toMatch(/\s—\s/);
      expect(t, t).not.toMatch(/!/);
      expect(t, t).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe("v221 · экран «Утро» (ui/morning.jsx)", () => {
  const M = rd("ui/morning.jsx");
  it("выбор дней — под часами, только когда сводка включена и сервер его знает; пояснение под ним", () => {
    expect(M).toContain('import { morningModel, dLong, hh, holesText, weekHoleDays, posAcc, thanksPeople, daysText, plural, upFirst, isoAdd, MORNING_HOURS, hourLabel, MORNING_DAYS, morningHasDays, morningPrefsLine, morningShiftNote } from "../lib/morning";');
    expect(M).toContain("{prefs.on && morningHasDays(prefs) ? (");
    expect(M).toContain('<div role="group" aria-label="В какие дни присылать" data-mo-days={prefs.shift ? "shift" : "all"}');
    expect(M).toContain('data-mo-day={v ? "shift" : "all"} disabled={busy === "prefs"} onClick={() => { if (!sel) saveShift(v); }}');
    expect(M).toContain('{morningShiftNote(prefs) ? <div data-mo-today={prefs.today || "none"}');
    expect(M).toContain("{morningPrefsLine(prefs)}");
    expect(M.indexOf('data-mo-hours={prefs.hour}')).toBeLessThan(M.indexOf('aria-label="В какие дни присылать"'));
  });
  it("сохранение: morning_shift_set, сразу на экране, не вышло — вернуть и сказать", () => {
    const f = M.slice(M.indexOf("const saveShift = (v) => {"), M.indexOf("const sendNow = () => {"));
    expect(f).toContain('setPrefs((p) => ({ ...(p || {}), shift: v }));');
    expect(f).toContain('rpc("morning_shift_set", { p_token: saToken(), p_shift: v })');
    expect(f).toContain('if (r && r.ok && r.prefs) setPrefs(r.prefs); else { setPrefs(was); setNote(rpcMissing(r) ? "Выбор дней появится вместе с этапом 75 на сервере." : "Не сохранилось. Попробуй ещё раз."); }');
    expect(f).toContain('.catch(() => { setBusy(""); setPrefs(was); setNote("Нет связи. Попробуй ещё раз."); });');
  });
});

describe("v221 · сервер: этап 75", () => {
  it("нужны этапы 38 и 40; колонка; ничего не удаляет", () => {
    expect(S75).toContain("raise exception 'Сначала этап 40 (supabase-stage40-morning.sql): «Утро руководителя»';");
    expect(S75).toContain("raise exception 'Сначала этап 38 (supabase-stage38-chat.sql): нужен график';");
    expect(S75).toContain("alter table sa_notify_prefs add column if not exists morning_shift boolean;");
    expect(S75).not.toMatch(/\bdrop\s/i);
    expect(S75).not.toMatch(/\bdelete\s+from/i);
  });
  it("по должности: менеджеру (не владельцу) только в смены; свой выбор главнее", () => {
    expect(S75).toContain("select coalesce(p_pick, lower(coalesce(p_pos, '')) = 'manager' and not coalesce(p_admin, false))");
  });
  it("_sa_morning_day: смена (любая, кейтеринг тоже), отпуск, выходной; не знаем — пусто, ошибка — тоже пусто", () => {
    const f = fnOf(S75, "_sa_morning_day");
    expect(f).toContain("if _sa_sh_def(cfg, _sa_sh_code(p_rest, s->>'id', p_day)) is not null then return 'shift'; end if;");
    expect(f).toContain("then return 'vac'; end if;");
    expect(f).toContain("return 'off';");
    expect(f).toContain("exception when others then\n  return '';");
    expect((f.match(/return '';/g) || []).length).toBe(4);
  });
  it("_sa_morning_due — этап 40 слово в слово, плюс выбор по должности и проверка смены", () => {
    const now = fnOf(S75, "_sa_morning_due"), was = fnOf(S40, "_sa_morning_due");
    expect(now).toContain("    if e.shift_only and _sa_morning_day(e.emp_id, e.restaurant, ld) in ('off', 'vac') then continue; end if;\n");
    const back = now.replace("    if e.shift_only and _sa_morning_day(e.emp_id, e.restaurant, ld) in ('off', 'vac') then continue; end if;\n", "")
      .replace(" as hr,\n                  _sa_morning_shift_only(em.position, em.is_admin, np.morning_shift) as shift_only\n", " as hr\n");
    expect(back).toBe(was);
    expect(now.indexOf("_sa_tg_was(e.emp_id, ld, 'morning')")).toBeLessThan(now.indexOf("if e.shift_only"));
    expect(now.indexOf("if e.shift_only")).toBeLessThan(now.indexOf("_sa_tg_once(e.emp_id, ld, 'morning')"));
  });
  it("настройки: прежние поля плюс shift и today; morning_shift_set — только руководителям", () => {
    const p = fnOf(S75, "_sa_morning_prefs");
    expect(p).toContain("return jsonb_build_object('on', coalesce(p.morning, true), 'hour', coalesce(p.morning_hour, 9), 'linked', coalesce(linked, false) and coalesce(on_, false),");
    expect(p).toContain("'shift', _sa_morning_shift_only(e.position, e.is_admin, p.morning_shift),");
    expect(p).toContain("'today', case when e.id is null then '' else _sa_morning_day(p_emp, e.restaurant, (now() at time zone _sa_tz(e.restaurant))::date) end);");
    const s = fnOf(S75, "morning_shift_set");
    expect(s).toContain("if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");
    expect(s).toContain("update sa_notify_prefs set morning_shift = p_shift, updated_at = now() where emp_id = c->>'id';");
  });
  it("права: служебные закрыты, выбор открыт; у каждой функции search_path", () => {
    expect(S75).toContain("revoke all on function _sa_morning_shift_only(text, boolean, boolean), _sa_morning_day(text, text, date), _sa_morning_prefs(text),\n  _sa_morning_due(boolean, timestamptz) from public, anon, authenticated;");
    expect(S75).toContain("grant execute on function morning_shift_set(text, boolean) to anon, authenticated;");
    const heads = S75.match(/create or replace function [^\n]+\nreturns [^\n]+/g) || [];
    expect(heads.length).toBe(5);
    for (const h of heads) expect(h, h).toContain("set search_path to public as $$");
  });
});

describe("v221 · демо-сервер — так же", () => {
  const PEOPLE = [{ id: "u-m", name: "Мария", surname: "Ким", restaurant: "R", position: "manager" }, { id: "u-r", name: "Роман", surname: "", restaurant: "R", position: "owner", is_admin: true },
    { id: "u-s", name: "Сергей", surname: "Иванов", restaurant: "R", position: "manager" }, { id: "e-a", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter" }];
  const SST = [{ id: 1, name: "Ким Мария", pos: "manager" }, { id: 3, name: "Иванов Сергей", pos: "manager", vacs: { "2026-10": [[29, 30]] } }, { id: 2, name: "Смирнова Анна", pos: "waiter" }];
  const mk = (o = {}) => makeServer({ today: "2026-10-29", rest: "R", people: PEOPLE, tok: { tm: "u-m", tr: "u-r", ts: "u-s", ta: "e-a" }, sstaff: SST,
    cfg: { shifts: [{ k: "Д", name: "День", from: 12, to: 20 }], staff: [] }, plan: { 1: { 0: "Д", 1: "Д" }, 3: { "-2": "Д" } }, menu: [], tgLinked: ["u-m", "u-r", "u-s"], ...o });
  it("по должности: менеджеру только в смены, владельцу каждый день; что сегодня в графике", () => {
    const s = mk();
    expect(s.rpc("morning_brief", { p_token: "tm" }).prefs).toMatchObject({ shift: true, today: "shift" });
    expect(s.rpc("morning_brief", { p_token: "tr" }).prefs).toMatchObject({ shift: false, today: "" });
    expect(s.rpc("morning_brief", { p_token: "ts" }).prefs).toMatchObject({ shift: true, today: "vac" });
  });
  it("выбор сохраняется, час его не сбивает, пусто — снова по должности; сотруднику нельзя", () => {
    const s = mk();
    expect(s.rpc("morning_shift_set", { p_token: "tm", p_shift: false }).prefs).toMatchObject({ on: true, hour: 9, shift: false });
    expect(s.rpc("morning_set", { p_token: "tm", p_hour: 11 }).prefs).toMatchObject({ hour: 11, shift: false });
    expect(s.rpc("morning_shift_set", { p_token: "tm", p_shift: null }).prefs.shift).toBe(true);
    expect(s.rpc("morning_shift_set", { p_token: "tr", p_shift: true }).prefs).toMatchObject({ shift: true, today: "" });
    expect(s.rpc("morning_shift_set", { p_token: "ta", p_shift: true }).error).toBe("forbidden");
    expect(s.rpc("morning_shift_set", { p_token: "мусор", p_shift: true }).error).toBe("auth");
  });
  it("без этапа 75: функции нет, настройки прежние", () => {
    const s = mk({ noStage75: true });
    expect(s.rpc("morning_shift_set", { p_token: "tm", p_shift: false }).code).toBe("PGRST202");
    expect(s.rpc("morning_brief", { p_token: "tm" }).prefs).toEqual({ on: true, hour: 9, linked: true, bot: true });
  });
});
