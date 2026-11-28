// v214 (Доп. 540): закрытые дни заведения и тип дня на дату.
// Владелец: «Столкнулся с тем, что я в настройках не могу указать дни, в которые ресторан не работает. И из-за этого
// правила графика мне выдают ошибку и дни, в которых мне не хватает сотрудников».
//   • lib/schedule-days.js — закрыто по неделе (rules.closedDows) и датой (days[d].closed), уровень дня 0, пометка
//     типа дня из листа дня, подпись «откуда тип»;
//   • lib/schedule-gen.js — в закрытый день никого (жёсткое правило whyNot);
//   • ui/schedule.jsx — «Часы работы»: выходные дни заведения; лист дня: «Обычный · Пиковый · Закрыто», «как в
//     правилах», «Снять смены этого дня»; штриховка в таблице, полоске и картинке; «закр.» в календаре сотрудника;
//   • этап 70 — утренняя сводка не ищет дыр в закрытый день.
// В браузере: tools/claude/e2e-v214.mjs; этап на базе — tools/claude/sql/test70.sh.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { isClosed, dayLevel, ruleLevel, markDayType, dayMarked, dayTypeWhy, openDays, closedByRule, DOW_EVERY } from "../lib/schedule-days.js";
import { generateSchedule } from "../lib/schedule-gen.js";

const rd = (f) => readFileSync(f, "utf8");
const fnBody = (sql, name) => { const i = sql.indexOf("create or replace function " + name + "("); if (i < 0) return ""; const o = sql.indexOf("$$", i); return sql.slice(i, sql.indexOf("$$;", o + 2) + 3); };

// месяц с понедельника: 1-е — пн, 5-е — пт, 7-е — вс
const dow = (d) => (d - 1) % 7;
const RULES = { peakDows: [4, 5], highDows: [3, 6], closedDows: [0], holidayPeak: true };
const ctx = (days = {}, extra = {}) => ({ rules: RULES, days, dow, holName: (d) => (d === 4 ? "Праздник" : null), levels: 2, ...extra });

describe("v214 · версия и журнал", () => {
  it("сборка v214, Дополнение 540 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(214);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 540 — .*\(v214\)/);
    const part = c.slice(c.indexOf("# Дополнение 540"));
    for (const w of ["не могу указать дни, в которые ресторан не работает", "lib/schedule-days.js", "closedDows", "days[d].closed",
      "supabase-stage70-closed-days.sql", "test70.sh", "e2e-v214.mjs", "«Снять смены этого дня»"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v214 · закрытые дни и тип дня (lib/schedule-days.js)", () => {
  it("закрыто по неделе, датой; дата главнее недели", () => {
    expect(closedByRule(RULES, 0)).toBe(true);
    expect(closedByRule({}, 0)).toBe(false);
    expect(isClosed(ctx(), 1)).toBe(true);                       // понедельник
    expect(isClosed(ctx(), 2)).toBe(false);
    expect(isClosed(ctx({ 8: { closed: false } }), 8)).toBe(false);   // банкет в выходной понедельник
    expect(isClosed(ctx({ 10: { closed: true } }), 10)).toBe(true);    // санитарный день в среду
    expect(isClosed(ctx({ 10: { note: "банкет" } }), 10)).toBe(false);
  });
  it("уровень: 0 — закрыто; пометка даты; праздник и дни недели по правилам; «высокий» при двух уровнях — пик", () => {
    expect(dayLevel(ctx(), 1)).toBe(0);
    expect(dayLevel(ctx(), 2)).toBe(1);
    expect(dayLevel(ctx(), 4)).toBe(3);                          // праздник считаем пиком
    expect(dayLevel(ctx(), 5)).toBe(3);                          // пятница
    expect(dayLevel(ctx({}, { levels: 3 }), 3)).toBe(1);
    expect(dayLevel(ctx({}, { levels: 3 }), 7)).toBe(2);         // воскресенье — высокий
    expect(dayLevel(ctx({}, { levels: 3 }), 6)).toBe(3);
    expect(dayLevel(ctx({}, { levels: 3 }), 11)).toBe(2);        // четверг — высокий
    expect(dayLevel(ctx(), 11)).toBe(1);                         // при двух уровнях высоких нет
    expect(dayLevel(ctx({ 2: { lvl: 3 } }), 2)).toBe(3);
    expect(dayLevel(ctx({ 2: { lvl: 2 } }), 2)).toBe(3);
    expect(dayLevel(ctx({ 2: { lvl: 2 } }, { levels: 3 }), 2)).toBe(2);
    expect(dayLevel(ctx({ 8: { closed: false, lvl: 3 } }), 8)).toBe(3);
    expect(dayLevel(ctx({ 5: { closed: true, lvl: 3 } }), 5)).toBe(0);
    expect(ruleLevel(ctx(), 1)).toBe(1);                         // по правилам, без «закрыто»
    expect(openDays(ctx(), 28)).toBe(24);
  });
  it("пометка из листа дня: совпало с правилами — не храним, заметка остаётся", () => {
    expect(markDayType(ctx(), 10, "closed")).toEqual({ closed: true });
    expect(markDayType(ctx(), 1, "closed")).toBe(null);          // понедельник и так закрыт
    expect(markDayType(ctx(), 8, 1)).toEqual({ closed: false });  // открыть выходной обычным днём
    expect(markDayType(ctx(), 8, 3)).toEqual({ closed: false, lvl: 3 });
    expect(markDayType(ctx(), 2, 3)).toEqual({ lvl: 3 });
    expect(markDayType(ctx(), 5, 3)).toBe(null);                 // пятница и так пик
    expect(markDayType(ctx(), 5, 1)).toEqual({ lvl: 1 });
    expect(markDayType(ctx({ 2: { lvl: 3, note: "банкет" } }), 2, null)).toEqual({ note: "банкет" });
    expect(markDayType(ctx({ 2: { closed: true } }), 2, null)).toBe(null);
    expect(markDayType(ctx({ 2: { closed: true, note: "санитарный день" } }), 2, 1)).toEqual({ note: "санитарный день" });
    expect(dayMarked({ 2: { note: "x" } }, 2)).toBe(false);
    expect(dayMarked({ 2: { closed: false } }, 2)).toBe(true);
  });
  it("откуда тип дня, словами", () => {
    expect(DOW_EVERY[0]).toBe("каждый понедельник");
    expect(dayTypeWhy(ctx(), 1)).toBe("Закрыто каждый понедельник: так в «Часах работы»");
    expect(dayTypeWhy(ctx({ 10: { closed: true } }), 10)).toBe("Закрыто только в эту дату");
    expect(dayTypeWhy(ctx({ 8: { closed: false } }), 8)).toBe("Открыты в эту дату, хотя каждый понедельник закрыто");
    expect(dayTypeWhy(ctx({ 2: { lvl: 3 } }), 2)).toBe("Своя пометка на эту дату");
    expect(dayTypeWhy(ctx(), 4)).toBe("Праздник: по правилам это пик");
    expect(dayTypeWhy(ctx(), 5)).toBe("Пик по правилам: каждую пятницу");
    expect(dayTypeWhy(ctx(), 2)).toBe("");
  });
});

describe("v214 · генератор: в закрытый день никого", () => {
  const base = {
    shifts: [{ k: "Д", name: "День", from: 12, to: 20 }, { k: "К", name: "Кейтеринг", from: 10, to: 22, extra: 1 }],
    need: { 1: { waiter: 2 }, 3: { waiter: 2 } }, split: {}, rules: { ...RULES, maxRow: 5, minOff: 2, minRest: 11, normMode: "floor" },
    posRules: { waiter: { pattern: "even" } }, dayShift: "Д",
    staff: ["Аня", "Боря", "Вера", "Гена"].map((n, i) => ({ id: "s" + i, name: n, pos: "waiter", norm: 140, off: [] })),
  };
  const run = (days, plan = {}, locks = {}) => generateSchedule({ cfg: base, DAYS: 28, dow, lvlOf: (d) => dayLevel(ctx(days), d), plan, locks,
    POS: [{ id: "waiter" }], mkey: "2027-02", restarts: 4, seed: 7 });
  const on = (pl, d) => Object.values(pl).filter((row) => row[d] === "Д").length;
  it("понедельники пусты, остальные дни закрыты полностью; дыр нет", () => {
    const res = run({});
    for (const d of [1, 8, 15, 22]) expect(on(res.plan, d), "день " + d).toBe(0);
    for (const d of [2, 3, 9, 14, 28]) expect(on(res.plan, d), "день " + d).toBe(2);
    expect(res.shortage).toBe(0);
    expect(res.whyNot(res.plan, base.staff[0], 1, "Д")).toBe("заведение в этот день закрыто");
  });
  it("дата главнее недели: банкет в понедельник 8-го — смены есть, санитарный день 10-го — нет", () => {
    const res = run({ 8: { closed: false }, 10: { closed: true } });
    expect(on(res.plan, 8)).toBe(2);
    expect(on(res.plan, 10)).toBe(0);
    expect(on(res.plan, 1)).toBe(0);
    expect(res.shortage).toBe(0);
  });
  it("закреплённая руками смена в закрытый день остаётся (уборка), генератор её не трогает", () => {
    const res = run({}, { s0: { 1: "Д" } }, { s0: { 1: 1 } });
    expect(res.plan.s0[1]).toBe("Д");
    expect(on(res.plan, 1)).toBe(1);
  });
});

describe("v214 · этап 70: утренняя сводка", () => {
  const sql = rd("supabase/supabase-stage70-closed-days.sql");
  it("без этапа 40 — понятная ошибка; закрыто датой и по неделе — уровень 0; права; итог", () => {
    expect(sql).toContain("raise exception 'Сначала этап 40 (supabase-stage40-morning.sql): утренняя сводка';");
    const f = fnBody(sql, "_sa_mo_lvl");
    expect(f).toContain("elsif jsonb_typeof(o) = 'object' and jsonb_typeof(o->'closed') = 'boolean' then");   // v216: «Особые дни» (dd) — ещё раньше
    expect(f).toContain("if (o->>'closed')::boolean then return 0; end if;");
    expect(f).toContain("elsif jsonb_typeof(r->'closedDows') = 'array' and (r->'closedDows') @> to_jsonb(w) then");
    // остальное — как в этапе 40, слово в слово (кроме пометки уровня: v216 — сначала «Особые дни»)
    const f40 = fnBody(rd("supabase/supabase-stage40-morning.sql"), "_sa_mo_lvl");
    const tail = (x) => x.slice(x.indexOf("  if ol in (1, 2, 3) then return"));
    expect(tail(f)).toBe(tail(f40));
    expect(sql).toContain("revoke all on function _sa_mo_lvl(jsonb, jsonb, date), _sa_mo_holes(text, jsonb, date) from public, anon, authenticated;");
    expect(sql).toContain("notify pgrst, 'reload schema';");
    expect(sql).toContain("select 'Закрытые и особые дни в утренней сводке:");
  });
  it("README этапов и инструментов знают этап 70", () => {
    expect(rd("supabase/README.md")).toContain("supabase-stage70-closed-days.sql");
    expect(rd("tools/claude/README.md")).toContain("test70.sh");
    expect(rd("tools/claude/README.md")).toContain("e2e-v214.mjs");
  });
});

describe("v214 · экран графика", () => {
  const S = rd("ui/schedule.jsx");
  it("правило по умолчанию и уровень дня из lib/schedule-days.js", () => {
    // v216: тот же импорт и «Особые дни» (dateOf, dayHours, hoursOn, dayNeed, needDowFrom, datesList)
    expect(S).toContain('import { isClosed, dayLevel, ruleLevel, markDayType, dayMarked, dayTypeWhy, closedByRule, dateOf, dayHours, hoursOn, dayNeed, needDowFrom, datesList } from "../lib/schedule-days";');
    expect(S).toContain('rules: { peakDows:[4,5], highDows:[3,6], closedDows:[], needMode:"levels", maxRow:5,');   // v216: + needMode
    expect(S).toContain("const dayCtx = { rules: cfg?.rules || DEFAULT_CONFIG.rules, days, dates: cfg?.dates || {}, iso: isoD, dow, holName, levels };");
    expect(S).toContain("const lvlOf = d => dayLevel(dayCtx, d);");
    expect(S).toContain("const closedOf = d => isClosed(dayCtx, d);");
  });
  it("ёмкость штата, «Проверка», красные точки, «Как в прошлом месяце» — без закрытых дней", () => {
    expect(S.split("if (!onVac(x, d) && !isDayOff(x, d) && !closedOf(d)) avail++;").length - 1).toBe(2);
    expect(S).toContain("заведение закрыто, а смены остались (");
    expect(S).toContain("if (d <= DAYS && sh && !sh.extra && d >= fb && closedOf(d) && !isLocked(sf.id, d)) bad.add(sf.id + \":\" + d);");
    expect(S).toContain("}, [plan, cfg, staff, DAYS, days, locks]);");
    expect(S).toContain("if (closedOf(d)) continue;                     // v214: в закрытый день прошлый месяц не переносим");
  });
  it("«Часы работы»: выходные дни заведения пилюлями, закрытый день строкой, «Снять» оставшиеся смены", () => {
    expect(S).toContain('<div data-closed-dows="" style={{ display:"flex", gap:4 }}>');
    expect(S).toContain('attrs={{ "data-closed-dow": wi }}');
    expect(S).toContain("закрыто весь день");
    expect(S).toContain("В закрытые дни остались смены: {leftClosed}. Генератор их больше не ставит.");
    expect(S).toContain("const sum1 = (openHrs.length ?");
    expect(S).toContain('c.rules = { ...c.rules, closedDows: [...(pr.closed || [])] };');
    expect(S).toContain('s: "09:00–18:00 · одна смена · вс выходной", closed: [6]');
  });
  it("лист дня: тип дня пилюлями, «как в правилах», закрытый день, «Снять смены этого дня»", () => {
    expect(S).toContain('<div data-day-type="" role="radiogroup" aria-label="Тип дня"');
    expect(S).toContain('{[...LVLS, [0, "закрыто"]].map(([l, nm]) => (');
    expect(S).toContain('onClick={() => setDayType(d, l === 0 ? "closed" : l)}');
    // v216: пометка — в «Особые дни» настроек (cfg.dates), старая пометка месяца снимается
    expect(S).toContain("const k = isoD(d), o = markDayType(dayCtx, d, t);");
    expect(S).toContain("patch(c => { const ds = { ...(c.dates || {}) }; if (o) ds[k] = o; else delete ds[k]; c.dates = ds; });");
    expect(S).toContain("как в правилах</span>");
    expect(S).toContain("Гостей не принимаем: генератор никого не ставит, «Проверка» не ищет здесь дыр.");
    expect(S).toContain("Снять смены этого дня</button>");
    expect(S).toContain("const n = clearClosed(d, true);");
  });
  it("таблица, полоска месяца, «Сегодня», календарь сотрудника и картинка знают закрытый день", () => {
    expect(S).toContain('const closedBg = a11y ? "repeating-linear-gradient(135deg,');
    expect(S.split("...(closedOf(d) ? { background: closedBg } : null),").length - 1).toBe(3);
    expect(S).toContain('data-strip-closed={cl ? "1" : undefined}');
    expect(S).toContain('{closedOf(today) ? " · заведение закрыто" : ""}');
    expect(S).toContain('<span data-cal-closed={d} style={{ fontSize: a11y ? 9.5 : 8.5, lineHeight:1, color:P.sub }}>закр.</span>');
    expect(S).toContain("if (closedOf(d) && !k) { hatch(cx, y + 1, ROW - 1); continue; }");
    expect(S).toContain(': vac ? "Отпуск" : closedOf(d) ? "Заведение закрыто" : "";');
    expect(S).toContain("заведение закрыто\n            </span>) : null}");
  });
});
