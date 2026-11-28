// v216 (Доп. 542): «Особые дни» и люди по дням недели в графике, официанты в очереди — по графику.
// Владелец: «ресторан не работает только 31 декабря и 1-го января. А 2-го не с 11, а с 16 ти работает. Хочу как раз
// таки это указать», «И все 5 по предложениям» и «По поводу очереди. Он не видит меня, хотя я на смене. И почему то
// добавляет в выбор очереди Раннера».
//   • lib/schedule-days.js — config.dates: закрыто, свои часы, тип дня, люди и подпись на дату; потребность по дням
//     недели (rules.needMode = "dows", config.needDow); свои часы и смены (shiftFits);
//   • lib/schedule-gen.js — needOf и openHoursOf: в свои часы даты — только смены, что подходят под них;
//   • ui/schedule.jsx — «Особые дни» в «Часах работы», «По дням недели» в «Сколько людей нужно», лист дня пишет тип
//     дня в «Особые дни» и ведёт туда за своими часами;
//   • этап 71 — в очереди к столам официант по графику месяца; этап 72 — утренняя сводка по дням недели.
// В браузере: tools/claude/e2e-v216.mjs; этапы на базе — tools/claude/sql/test69.sh (этап 71) и test72.sh.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { isClosed, dayLevel, markDayType, dayTypeWhy, dateOf, dayHours, hoursOn, shiftFits, dayNeed, needDowFrom, datesList } from "../lib/schedule-days.js";
import { generateSchedule } from "../lib/schedule-gen.js";

const rd = (f) => readFileSync(f, "utf8");
const fnBody = (sql, name) => { const i = sql.indexOf("create or replace function " + name + "("); if (i < 0) return ""; const o = sql.indexOf("$$", i); return sql.slice(i, sql.indexOf("$$;", o + 2) + 3); };

// январь 2027: 1-е — пятница, 4-е — понедельник. Дни недели с понедельника (0)
const dow = (d) => (d + 3) % 7;
const iso = (d) => "2027-01-" + String(d).padStart(2, "0");
const RULES = { peakDows: [4, 5], highDows: [], closedDows: [0], holidayPeak: false };
const ctx = (dates = {}, days = {}, extra = {}) => ({ rules: RULES, days, dates, iso, dow, holName: () => null, levels: 2, ...extra });
const NEW_YEAR = { "2026-12-31": { closed: true }, "2027-01-01": { closed: true }, "2027-01-02": { hours: [16, 24] } };

describe("v216 · версия и журнал", () => {
  it("сборка v216, Дополнение 542 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(216);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 542 — .*\(v216\)/);
    const part = c.slice(c.indexOf("# Дополнение 542"));
    for (const w of ["ресторан не работает только 31 декабря и 1-го января", "добавляет в выбор очереди Раннера", "«Особые дни»",
      "config.dates", "needDow", "lib/schedule-days.js", "supabase-stage71-queue-by-schedule.sql", "supabase-stage72-need-by-dow.sql",
      "test72.sh", "e2e-v216.mjs"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v216 · «Особые дни» (lib/schedule-days.js)", () => {
  it("закрыто датой; дата главнее пометки месяца и недели", () => {
    expect(dateOf(ctx(NEW_YEAR), 2)).toEqual({ hours: [16, 24] });
    expect(dateOf(ctx(NEW_YEAR), 3)).toBe(null);
    expect(dateOf({ ...ctx(NEW_YEAR), iso: undefined }, 2)).toBe(null);
    expect(isClosed(ctx(NEW_YEAR), 1)).toBe(true);                                         // 1 января
    expect(isClosed(ctx(NEW_YEAR), 2)).toBe(false);                                        // 2-го работаем с 16
    expect(isClosed(ctx(), 4)).toBe(true);                                                 // понедельник по неделе
    expect(isClosed(ctx({ "2027-01-04": { closed: false } }), 4)).toBe(false);             // банкет в понедельник
    expect(isClosed(ctx({ "2027-01-06": { closed: false } }, { 6: { closed: true } }), 6)).toBe(false);   // дата главнее месяца
    expect(isClosed(ctx({ "2027-01-06": { hours: [16, 24] } }, { 6: { closed: true } }), 6)).toBe(true);  // без closed — решает месяц
  });
  it("тип дня: своя пометка даты, «высокий» при двух уровнях — пик, закрытая дата — 0", () => {
    expect(dayLevel(ctx(NEW_YEAR), 1)).toBe(0);
    expect(dayLevel(ctx(NEW_YEAR), 2)).toBe(3);                                            // суббота — пик по правилам
    expect(dayLevel(ctx({ "2027-01-05": { lvl: 3 } }), 5)).toBe(3);
    expect(dayLevel(ctx({ "2027-01-05": { lvl: 2 } }), 5)).toBe(3);
    expect(dayLevel(ctx({ "2027-01-05": { lvl: 2 } }, {}, { levels: 3 }), 5)).toBe(2);
    expect(dayLevel(ctx({ "2027-01-08": { lvl: 1 } }, { 8: { lvl: 3 } }), 8)).toBe(1);   // дата главнее пометки месяца
    expect(dayLevel(ctx({ "2027-01-04": { closed: false, lvl: 3 } }), 4)).toBe(3);
  });
  it("свои часы: проверка формата, после полуночи, часы дня по неделе", () => {
    expect(dayHours(ctx(NEW_YEAR), 2)).toEqual([16, 24]);
    expect(dayHours(ctx({ "2027-01-05": { hours: [18, 2] } }), 5)).toEqual([18, 2]);
    for (const h of [[16, 16], [24, 30], ["a", 24], [16.5, 24], [16], [16, 31], null]) expect(dayHours(ctx({ "2027-01-05": { hours: h } }), 5), JSON.stringify(h)).toBe(null);
    const week = [[12, 24], [12, 24], [12, 24], [12, 24], [12, 26], [12, 26], [12, 24]];
    expect(hoursOn(ctx(NEW_YEAR), 2, week)).toEqual([16, 24]);
    expect(hoursOn(ctx(NEW_YEAR), 8, week)).toEqual([12, 26]);                              // пятница по неделе
    expect(hoursOn(ctx(), 8, null)).toEqual([12, 24]);
  });
  it("смена под свои часы: приходят не раньше чем за час до открытия и до закрытия", () => {
    const sh = (from) => ({ k: "x", from, to: from + 8 });
    expect([11, 12, 14, 15, 16, 20, 23, 24].map((f) => shiftFits([16, 24], sh(f)))).toEqual([false, false, false, true, true, true, true, false]);
    expect(shiftFits([18, 2], sh(25))).toBe(true);                                         // после полуночи — 26
    expect(shiftFits(null, sh(10))).toBe(true);                                            // обычный день не трогаем
  });
  it("сколько людей: по типу дня, по дням недели, «Особые дни» поверх, закрыто — никого", () => {
    const cfg = { rules: RULES, need: { 1: { waiter: 2, bar: 1 }, 3: { waiter: 3, bar: 2 } } };
    expect(dayNeed(ctx(NEW_YEAR), cfg, 5)).toEqual({ waiter: 2, bar: 1 });                  // вторник
    expect(dayNeed(ctx(NEW_YEAR), cfg, 8)).toEqual({ waiter: 3, bar: 2 });                  // пятница — пик
    expect(dayNeed(ctx(NEW_YEAR), cfg, 1)).toEqual({});
    expect(dayNeed(ctx(NEW_YEAR), cfg, 4)).toEqual({});                                     // понедельник закрыт
    const dw = { ...cfg, rules: { ...RULES, needMode: "dows" }, needDow: { waiter: [2, 2, 2, 3, 4, 5, 3], bar: [0, 1, 1, 1, 2, 2, 1], runner: "x" } };
    expect([5, 7, 8, 9, 10].map((d) => dayNeed(ctx(), dw, d))).toEqual([{ waiter: 2, bar: 1 }, { waiter: 3, bar: 1 }, { waiter: 4, bar: 2 },
      { waiter: 5, bar: 2 }, { waiter: 3, bar: 1 }]);
    expect(dayNeed(ctx({ "2027-01-06": { need: { waiter: 4, bar: 0 } } }), dw, 6)).toEqual({ waiter: 4, bar: 0 });
    expect(dayNeed(ctx({ "2027-01-06": { need: { waiter: 4 } } }), cfg, 6)).toEqual({ waiter: 4, bar: 1 });   // остальные на месте
    expect(dayNeed(ctx(), { ...cfg, rules: { ...RULES, needMode: "dows" } }, 8)).toEqual({ waiter: 3, bar: 2 });   // без needDow — по типу
  });
  it("переход «По дням недели»: числа из потребности по типу дня", () => {
    const cfg = { rules: RULES, need: { 1: { waiter: 2 }, 2: { waiter: 4 }, 3: { waiter: 3 } } };
    expect(needDowFrom(ctx(), cfg, ["waiter", "bar"])).toEqual({ waiter: [2, 2, 2, 2, 3, 3, 2], bar: [0, 0, 0, 0, 0, 0, 0] });
    expect(needDowFrom(ctx({}, {}, { levels: 3, rules: { ...RULES, highDows: [3] } }), cfg, ["waiter"])).toEqual({ waiter: [2, 2, 2, 4, 3, 3, 2] });
  });
  it("список «Особых дней»: по порядку, с начала месяца, без чужих ключей", () => {
    const ds = { ...NEW_YEAR, "2026-11-30": { closed: true }, "2027-3-8": { lvl: 3 }, "2027-03-08": { lvl: 3, note: "8 Марта" }, "2027-02-01": "x" };
    expect(datesList(ds, "2026-12-01").map((x) => x.iso)).toEqual(["2026-12-31", "2027-01-01", "2027-01-02", "2027-03-08"]);
    expect(datesList(ds, "2026-12-01")[3]).toEqual({ iso: "2027-03-08", lvl: 3, note: "8 Марта" });
    expect(datesList(null)).toEqual([]);
  });
  it("лист дня пишет в «Особые дни»: часы и люди даты остаются, старая пометка месяца не мешает выбору", () => {
    expect(markDayType(ctx(), 6, "closed")).toEqual({ closed: true });
    expect(markDayType(ctx(), 4, "closed")).toBe(null);                                       // понедельник и так закрыт
    expect(markDayType(ctx(), 4, 1)).toEqual({ closed: false });
    expect(markDayType(ctx(), 8, 3)).toBe(null);                                              // пятница и так пик
    const own = { "2027-01-05": { hours: [16, 24], need: { waiter: 4 }, note: "банкет" } };
    expect(markDayType(ctx(own), 5, 3)).toEqual({ hours: [16, 24], need: { waiter: 4 }, note: "банкет", lvl: 3 });
    expect(markDayType(ctx({ "2027-01-05": { ...own["2027-01-05"], lvl: 3 } }), 5, null)).toEqual(own["2027-01-05"]);
    expect(markDayType(ctx({}, { 5: { lvl: 3 } }), 5, 3)).toEqual({ lvl: 3 });                // старый «пик» месяца не съедает выбор
    expect(markDayType(ctx({}, { 5: { lvl: 3 } }), 5, 1)).toBe(null);
    expect(markDayType(ctx({}, { 6: { closed: true } }), 6, "closed")).toEqual({ closed: true });
  });
  it("откуда тип дня: «Особые дни»", () => {
    expect(dayTypeWhy(ctx(NEW_YEAR), 1)).toBe("Закрыто в эту дату: так в «Особых днях»");
    expect(dayTypeWhy(ctx({ "2027-01-04": { closed: false } }), 4)).toBe("Открыты в эту дату, хотя каждый понедельник закрыто");
    expect(dayTypeWhy(ctx({ "2027-01-05": { lvl: 3 } }), 5)).toBe("Своя пометка на эту дату");
    expect(dayTypeWhy(ctx(NEW_YEAR), 2)).toBe("Пик по правилам: каждую субботу");             // свои часы — не пометка типа
  });
});

describe("v216 · генератор: свои часы и люди на дату", () => {
  const cfg = {
    shifts: [{ k: "У", name: "Утро", from: 11, to: 19 }, { k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 },
      { k: "К", name: "Кейтеринг", from: 10, to: 22, extra: 1 }],
    need: { 1: { waiter: 2 }, 3: { waiter: 3 } }, split: {}, rules: { ...RULES, closedDows: [], maxRow: 5, minOff: 2, minRest: 11, normMode: "floor" },
    posRules: { waiter: { pattern: "even" } }, dayShift: "Д",
    staff: ["Аня", "Боря", "Вера", "Гена", "Дима", "Ева"].map((n, i) => ({ id: "s" + i, name: n, pos: "waiter", norm: 140, off: [] })),
  };
  const run = (c, dates) => {
    const x = { ...ctx(dates), rules: c.rules };
    return generateSchedule({ cfg: c, DAYS: 31, dow, lvlOf: (d) => dayLevel(x, d), needOf: (d) => dayNeed(x, c, d), openHoursOf: (d) => dayHours(x, d),
      plan: {}, locks: {}, POS: [{ id: "waiter" }], mkey: "2027-01", restarts: 4, seed: 7 });
  };
  const col = (res, d) => Object.values(res.plan).map((r) => r[d] || "").filter(Boolean).sort().join("");
  it("1 января — никого, 2-го с 16 — только вечер, 3-го — обычный день", () => {
    const res = run(cfg, NEW_YEAR);
    expect(col(res, 1)).toBe("");
    expect(col(res, 2)).toBe("ВВВ");
    expect(col(res, 3)).toBe("ДД");
    expect(res.shortage).toBe(0);
    expect(res.whyNot(res.plan, cfg.staff[0], 2, "Д")).toBe("в этот день работаем с 16:00, а смена с 12:00");
    expect(res.whyNot(res.plan, cfg.staff[0], 1, "В")).toBe("заведение в этот день закрыто");
  });
  it("люди по дням недели и своё число на дату", () => {
    const c = { ...cfg, rules: { ...cfg.rules, needMode: "dows" }, needDow: { waiter: [2, 2, 2, 2, 3, 4, 3] } };
    const res = run(c, { "2027-01-13": { need: { waiter: 3 } } });
    expect([9, 16, 23].map((d) => col(res, d).length)).toEqual([4, 4, 4]);                   // субботы
    expect([8, 15].map((d) => col(res, d).length)).toEqual([3, 3]);                           // пятницы
    expect([6, 13, 20].map((d) => col(res, d).length)).toEqual([2, 3, 2]);                    // среды, 13-го — своё число
    expect(res.shortage).toBe(0);
  });
  it("без needOf и openHoursOf — как раньше, по уровню дня", () => {
    const x = ctx(NEW_YEAR);
    const res = generateSchedule({ cfg, DAYS: 31, dow, lvlOf: (d) => dayLevel(x, d), plan: {}, locks: {}, POS: [{ id: "waiter" }], mkey: "2027-01", restarts: 4, seed: 7 });
    expect(col(res, 2)).toBe("ДДД");
    expect(col(res, 1)).toBe("");
  });
});

describe("v216 · экран графика (ui/schedule.jsx)", () => {
  const S = rd("ui/schedule.jsx");
  it("настройки: dates и needDow, needMode по умолчанию — по типу дня; dates всегда объект", () => {
    expect(S).toContain("dates: {}, needDow: null,");
    expect(S).toContain('closedDows:[], needMode:"levels", maxRow:5,');
    expect(S).toContain('if (!out.dates || typeof out.dates !== "object" || Array.isArray(out.dates)) out.dates = {};   // v216');
  });
  it("потребность и часы дня — из lib/schedule-days.js; генератору — во всех семи вызовах", () => {
    // v219: и «Часы пик» поверх
    expect(S).toContain("const needOf = d => { const n = dayNeed(dayCtx, cfg, d), hp = hourPlanOfD(d);");
    expect(S).toContain("const dateHoursOf = d => dayHours(dayCtx, d);");
    expect(S.split("needOf, openHoursOf: dateHoursOf, hourPlanOf: hourPlanOfD, plan").length - 1).toBe(7);   // v219: hourPlanOf
    expect(S).toContain("const hrs = hoursOn(dayCtx, d, cfg.hours), ownH = dateHoursOf(d);");
    expect(S).toContain("const ctx = { staff, plan, POS, needOf, shiftOf, hardOff };");
  });
  it("«Сколько людей нужно»: по типу дня или по дням недели, семь узких полей на должность", () => {
    expect(S).toContain('{[["levels", "По типу дня"], ["dows", "По дням недели"]].map(([k, t]) => (');
    expect(S).toContain('if (k === "dows" && !(c.needDow && typeof c.needDow === "object")) c.needDow = needDowFrom(dayCtx, c, POS.map(x => x.id));');
    expect(S).toContain("<div key={id} data-need-dow={id}");
    expect(S).toContain('<Num w="100%" inp={inp} v={Number((cfg.needDow?.[id] || [])[wi]) || 0} min={0} max={20}');
    expect(S).toContain('<div key={wi} style={{ flex:"1 1 0", minWidth:0, display:"flex", flexDirection:"column"');   // 320 px: семь колонок в экране
    expect(S).toContain('const sum3 = (byDow ? "по дням недели: "');   // v219: и «часы пик: N»
    expect(S).toContain("function Num({ v, min, max, set, inp, w = 60 })");
  });
  it("«Часы работы» → «Особые дни»: список, форма, сохранение в config.dates", () => {
    for (const s of ['<div data-dates-list="">', "data-date-row={x.iso}", 'data-date-del={x.iso}', '<div data-date-form=""', '<input type="date" data-date-iso=""',
      '"data-date-closed": "1"', ">Закрыто</Pill>", ">Работаем</Pill>", ">Свои часы</Pill>", ">Своё число людей</Pill>", '"data-date-lvl": l',
      '{[[0, "как обычно"], ...LVLS].map(([l, nm]) => (', 'placeholder="подпись: банкет"', '{de.orig ? "Сохранить дату" : "Добавить дату"}',
      ">+ добавить дату</button>", "Пока ни одной даты", " · особых дней: "]) expect(S, s).toContain(s);
    expect(S).toContain("if (closedByRule(cfg.rules, isoDow(de.iso))) o.closed = false;      // выходной по неделе, а в эту дату работаем");
    expect(S).toContain("if (Object.keys(o).length) ds[de.iso] = o; else delete ds[de.iso]; c.dates = ds; });");
    expect(S).toContain("const dList = datesList(cfg.dates, fromIso);");
    expect(S).toContain("const needDefault = (iso, lvl) => dayNeed(isoCtx(iso, { closed: false, ...(lvl ? { lvl } : null) }), cfg, 1);");
    expect(S).toContain("В эту дату и так работаем как обычно: сохранять нечего");
  });
  it("лист дня: тип дня — в «Особые дни», ссылка за своими часами и людьми", () => {
    expect(S).toContain("patch(c => { const ds = { ...(c.dates || {}) }; if (o) ds[k] = o; else delete ds[k]; c.dates = ds; });");
    expect(S).toContain("setDays(dd => { const x = { ...(dd[d] || {}) }; delete x.closed; delete x.lvl;");
    expect(S).toContain('<span data-day-special="" role="button"');
    expect(S).toContain('{cfg.dates?.[isoD(d)] ? "изменить в «Особых днях»" : "свои часы или люди на эту дату"}');
    expect(S).toContain('setBossDay(0); setTab("setup"); setOpenSec(1); openDate(isoD(d));');
    expect(S).toContain("свои часы: с ${ownH[0]}:00 до ${ownH[1] > 24 ? ownH[1] - 24 : ownH[1]}:00");
  });
});

describe("v216 · этапы 71 и 72", () => {
  it("этап 71: официант для очереди — по роли в графике месяца, без графика — по должности", () => {
    const sql = rd("supabase/supabase-stage71-queue-by-schedule.sql");
    expect(sql).toContain("raise exception 'Сначала этап 69 (supabase-stage69-waiter-queue.sql): очередь официантов';");
    const f = fnBody(sql, "_sa_queue_waiter");
    expect(f).toContain("sp := lower(coalesce(_sa_sh_staff(cfg, p_emp, to_char(_sa_queue_day(p_rest), 'YYYY-MM'))->>'pos', ''));");
    expect(f).toContain("if coalesce(sp, '') <> '' then return sp = 'waiter'; end if;");
    expect(f).toContain("return pos = 'waiter';");
    expect(fnBody(sql, "_sa_queue_json")).toContain("and _sa_queue_waiter(p_rest, e.id::text)");
    expect(sql).toContain("revoke all on function _sa_queue_waiter(text, text), _sa_queue_json(jsonb, text, jsonb) from public, anon, authenticated;");
    expect(rd("tools/claude/sql/test69.sh")).toContain("supabase-stage71-queue-by-schedule.sql");
    expect(rd("tools/claude/demo-app/fake-server.js")).toContain('const qWaiter = (e) => { const st = staffOf(e.id), sp = st && st.pos; return sp ? sp === "waiter" : e.position === "waiter"; };');
  });
  it("этап 72: потребность дня — _sa_mo_need, по дням недели или по типу, «Особые дни» поверх", () => {
    const sql = rd("supabase/supabase-stage72-need-by-dow.sql");
    expect(sql).toContain("raise exception 'Сначала этап 70 (supabase-stage70-closed-days.sql): закрытые и особые дни';");
    const f = fnBody(sql, "_sa_mo_need");
    expect(f).toContain("if lv = 0 then return need; end if;");
    expect(f).toContain("if p_cfg->'rules'->>'needMode' = 'dows' and jsonb_typeof(nd) = 'object' then");
    expect(f).toContain("need := need || jsonb_build_object(p, _sa_num(nd->p->>w)::int);");
    expect(f).toContain("need := need || (dd->'need');");
    expect(fnBody(sql, "_sa_mo_holes")).toContain("need := _sa_mo_need(p_cfg, pl->'days', p_day);");
    expect(sql).toContain("revoke all on function _sa_mo_need(jsonb, jsonb, date), _sa_mo_holes(text, jsonb, date) from public, anon, authenticated;");
    // в этапе 70 «need || dd->'need'» читалось как «(need || dd)->'need'»: своё число на дату стирало остальные должности
    expect(rd("supabase/supabase-stage70-closed-days.sql")).toContain("then need := need || (dd->'need'); end if;");
    expect(rd("supabase/supabase-stage70-closed-days.sql")).not.toContain("need := need || dd->'need'");
  });
  it("README этапов и инструментов знают этапы 71, 72 и проверки v216", () => {
    const R = rd("supabase/README.md"), T = rd("tools/claude/README.md");
    for (const s of ["supabase-stage71-queue-by-schedule.sql", "supabase-stage72-need-by-dow.sql"]) expect(R, s).toContain(s);
    for (const s of ["test72.sh", "e2e-v216.mjs"]) expect(T, s).toContain(s);
  });
});
