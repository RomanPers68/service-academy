// v56 (Доп. 369): «что сейчас» на главной — одно действие по времени и смене; «С возвращением»; первый день без нулей;
// логотип на четверть меньше.
//
// Владелец — на предложения «как сделать, чтобы было приятно заходить»: «Давай все😉»; по логотипу: «главное что бы
// не слишком был мелким». Вид в браузере — tools/claude/e2e-v56.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { nowMode, nowCardText, untilText, hhmm, daysAway, dayDiff, moodTier, MOOD_REPLY, NOW_BEFORE_H, NOW_AFTER_H, NOW_AWAY_DAYS } from "../lib/now-card.js";

const rd = (f) => readFileSync(f, "utf8");
const at = (h, m = 0) => { const d = new Date(2026, 9, 18); d.setHours(h, m, 0, 0); return d; };
const EVE = { off: false, from: 16, to: 24 };     // вечерняя смена
const DAY = { off: false, from: 12, to: 20 };     // дневная
const base = { started: true, warmReady: true, warmDone: false, due: 0, away: 0, openAway: 0, stepsToday: 0, mood: null };

describe("v56: nowMode — что показать сейчас", () => {
  it("первый день (в треке ничего не пройдено) — никакой «сейчас»: главное действие одно, первый урок", () => {
    expect(nowMode({ ...base, started: false, now: at(14), shift: EVE })).toBe(null);
    expect(nowMode({ ...base, started: false, now: at(11), away: 9, openAway: 9 })).toBe(null);
  });
  it("до смены: за 4 часа и меньше — разминка (если собрана и не сделана); раньше — нет", () => {
    expect(NOW_BEFORE_H).toBe(4);
    expect(nowMode({ ...base, now: at(14, 20), shift: EVE })).toEqual({ mode: "before", mins: 100, from: 16, to: 24 });
    expect(nowMode({ ...base, now: at(11, 30), shift: EVE })).toBe(null);
    expect(nowMode({ ...base, now: at(14), shift: EVE, warmDone: true })).toBe(null);
    expect(nowMode({ ...base, now: at(14), shift: EVE, warmReady: false })).toBe(null);
    expect(nowMode({ ...base, now: at(15, 59, 30), shift: EVE }).mins).toBe(1);
  });
  it("на смене — «в перерыв»: с числом вопросов на повтор", () => {
    expect(nowMode({ ...base, now: at(18), shift: EVE, due: 5 })).toEqual({ mode: "during", to: 24, due: 5 });
    expect(nowMode({ ...base, now: at(12), shift: DAY })).toEqual({ mode: "during", to: 20, due: 0 });
    expect(nowMode({ ...base, now: at(16), shift: EVE, warmDone: true })).toEqual({ mode: "during", to: 24, due: 0 });
  });
  it("после смены — 4 часа спрашиваем «как прошла», если ещё не отметил настрой", () => {
    expect(NOW_AFTER_H).toBe(4);
    expect(nowMode({ ...base, now: at(20, 30), shift: DAY })).toEqual({ mode: "after", to: 20 });
    expect(nowMode({ ...base, now: at(23, 59), shift: DAY })).toEqual({ mode: "after", to: 20 });
    expect(nowMode({ ...base, now: at(20, 30), shift: DAY, mood: "4" })).toBe(null);
    expect(nowMode({ ...base, now: at(20, 30), shift: { off: false, from: 8, to: 16 } })).toBe(null);
  });
  it("выходной и неизвестный график — без смены; смена «через полночь» считается до 24", () => {
    expect(nowMode({ ...base, now: at(14), shift: { off: true } })).toBe(null);
    expect(nowMode({ ...base, now: at(14), shift: null })).toBe(null);
    expect(nowMode({ ...base, now: at(23), shift: { off: false, from: 18, to: 2 } })).toEqual({ mode: "during", to: 24, due: 0 });
  });
  it("«С возвращением» — 3+ дня без занятий И без заходов, разминка собрана, сегодня ещё ни шага", () => {
    expect(NOW_AWAY_DAYS).toBe(3);
    expect(nowMode({ ...base, now: at(11), away: 5, openAway: 5 })).toEqual({ mode: "back", away: 5 });
    expect(nowMode({ ...base, now: at(11), away: 5, openAway: 1 })).toBe(null);      // заходил вчера — не «вернулся»
    expect(nowMode({ ...base, now: at(11), away: 2, openAway: 99 })).toBe(null);
    expect(nowMode({ ...base, now: at(11), away: 5, openAway: 99, stepsToday: 1 })).toBe(null);
    expect(nowMode({ ...base, now: at(11), away: 5, openAway: 5, warmDone: true })).toBe(null);
    // смена важнее: до смены — разминка «до смены», а не «с возвращением»
    expect(nowMode({ ...base, now: at(14), shift: EVE, away: 5, openAway: 5 }).mode).toBe("before");
  });
});

describe("v56: тексты карточки", () => {
  it("до смены: «ДО СМЕНЫ · 1 Ч 40 МИН», разминка, «Начать»", () => {
    const t = nowCardText({ mode: "before", mins: 100 }, { warmN: 3, warmWhat: "ситуации" });
    expect(t).toEqual({ tag: "ДО СМЕНЫ · 1 Ч 40 МИН", title: "Разминка перед сменой", sub: "3 ситуации · 2 мин — освежишь главное", cta: "Начать", action: "warmup", icon: "clock" });
  });
  it("на смене: ошибки (с правильным падежом) или SOS", () => {
    expect(nowCardText({ mode: "during", to: 20, due: 1 }).sub).toBe("1 вопрос ждёт · хватит минуты");
    expect(nowCardText({ mode: "during", to: 20, due: 3 }).sub).toBe("3 вопроса ждут · хватит минуты");
    expect(nowCardText({ mode: "during", to: 20, due: 12 }).sub).toBe("12 вопросов ждут · хватит минуты");
    expect(nowCardText({ mode: "during", to: 24, due: 2 })).toMatchObject({ tag: "НА СМЕНЕ · ДО 24:00", action: "mistakes", cta: "Ответить" });
    expect(nowCardText({ mode: "during", to: 20, due: 0 })).toMatchObject({ title: "Если в зале жарко — SOS", action: "sos", cta: "Открыть" });
  });
  it("после смены — «Как прошла смена?» без кнопки (пять лиц); «С возвращением» — разминка", () => {
    expect(nowCardText({ mode: "after", to: 20 })).toMatchObject({ tag: "СМЕНА ПОЗАДИ", title: "Как прошла смена?", cta: null, action: "mood" });
    expect(nowCardText({ mode: "back", away: 5 }, { warmN: 2, warmWhat: "вопроса" })).toMatchObject({ tag: "С ВОЗВРАЩЕНИЕМ", title: "Освежим за 2 минуты",
      sub: "2 вопроса из пройденного — вспомнишь главное", action: "warmup" });
    expect(nowCardText(null)).toBe(null);
  });
  it("время: «35 мин», «2 ч», «1 ч 5 мин»; часы «20:00», конец вечерней смены — «24:00», как в графике", () => {
    expect(untilText(35)).toBe("35 мин");
    expect(untilText(120)).toBe("2 ч");
    expect(untilText(65)).toBe("1 ч 5 мин");
    expect(hhmm(20)).toBe("20:00");
    expect(hhmm(24)).toBe("24:00");
    expect(hhmm(9.5)).toBe("09:30");
  });
  it("настрой: та же шкала из пяти лиц (1–2 тяжело, 3 ровно, 4–5 хорошо); разбор с Наставником — сразу с вопросом", () => {
    expect([1, 2, 3, 4, 5].map(moodTier)).toEqual(["hard", "hard", "ok", "good", "good"]);
    for (const k of ["good", "ok", "hard"]) { expect(MOOD_REPLY[k].ask.length).toBeGreaterThan(40); expect(MOOD_REPLY[k].cta).toMatch(/^(Рассказать|Разобрать)$/); }
    expect(MOOD_REPLY.good.ask).not.toMatch(/повторял\b/);   // без рода
  });
});

describe("v56: перерыв в занятиях", () => {
  it("dayDiff — по календарю; daysAway — от последнего дня с занятиями до сегодня (сегодня не считается)", () => {
    expect(dayDiff("2026-10-15", "2026-10-18")).toBe(3);
    expect(dayDiff("2026-09-30", "2026-10-01")).toBe(1);
    expect(dayDiff("2026-03-28", "2026-03-30")).toBe(2);   // через перевод часов — всё равно по дням
    expect(daysAway({}, "2026-10-18")).toBe(0);              // занятий не было — новичок, не «вернувшийся»
    expect(daysAway({ "2026-10-12": { st: 2 }, "2026-10-10": { st: 1 } }, "2026-10-18")).toBe(6);
    expect(daysAway({ "2026-10-12": { st: 2 }, "2026-10-18": { st: 1 } }, "2026-10-18")).toBe(6);
    expect(daysAway({ "2026-10-17": { s: 1 } }, "2026-10-18")).toBe(1);
  });
});

describe("v56: главная", () => {
  const app = rd("App.jsx"), home = rd("ui/screens-roleselect.jsx"), day = rd("ui/day-cards.jsx"), mood = rd("ui/mood-cards.jsx");
  it("App считает «сейчас» по смене, разминке, ошибкам, перерыву и настрою; часы — раз в минуту", () => {
    expect(app).toContain("import { nowMode, nowCardText, daysAway, dayDiff } from \"./lib/now-card\";");
    expect(app).toContain("const nowCtx = useMemo(() => (profile && role ? nowMode({ now: new Date(), shift: shiftToday, started: !firstDay, warmReady: warmSits.length >= 2, warmDone: warmDone === todayKey,");
    expect(app).toContain("due: dueNow, away: daysAway(activity, todayKey), openAway, stepsToday: todaySteps, mood: shiftMood }) : null),");
    expect(app).toContain("React.useEffect(() => { const t = setInterval(() => setNowTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);");
    expect(app).toContain("nowCard={nowCard} nowOn={nowOn}");
    expect(app).toContain("const nowOn = { warmup: openWarmup, mistakes: () => navigate(\"mistakes\"), sos: () => navigate(\"sos\"), mood: saveShiftMood, ask: (q) => askMentor(q) };");
  });
  it("последний заход: sa_last_open; день возвращения держится до вечера (sa_back_day)", () => {
    expect(app).toContain("prev = localStorage.getItem(\"sa_last_open\" + ukP); back = localStorage.getItem(\"sa_back_day\" + ukP);");
    expect(app).toContain("let gap = prev ? dayDiff(prev, todayKey) : 99;");
    expect(app).toContain("if (back === todayKey) gap = 99;");
    expect(app).toContain("try { localStorage.setItem(\"sa_last_open\" + ukP, todayKey); } catch (e) {}");
  });
  it("«как прошла смена» — та же запись, что «Как настрой сегодня?» (sa_mood_<дата> + save_mood)", () => {
    expect(mood).toContain("export const moodKey = (day) => \"sa_mood_\" + day;");
    expect(mood).toContain("try { rpc(\"save_mood\", { p_token: saToken(), p_mood: m, p_day: day }); } catch(e) {}");
    expect(mood).toContain("recordMood(m, today);");
    expect(app).toContain("const saveShiftMood = useCallback((lvl) => { recordMood(lvl, todayKey); setShiftMood(String(lvl)); }, [todayKey]);");
  });
  it("карточка «сейчас» — на месте карточки трека; трек — строкой «Дальше»; первый день — как было", () => {
    // v68 (Доп. 381): карточка — «Приглашение» (ui/now-hero.jsx NowInvitation): строка «Дальше» и лица — там
    const hero = rd("ui/now-hero.jsx");
    expect(home).toContain("<NowInvitation key={card.mode} ctx={card} a11y={a11y} rows={rows} foot={foot} on={ctx ? nowOn : { go }}");
    expect(home).toContain(": (nowCard && !firstDay ? nowCard : null);");
    expect(home).toContain('? (next ? [{ key: "next", label: "Дальше:", title: nextTitle, onClick: go }] : [])');
    expect(hero).toContain("export function NowInvitation({ refEl, ctx, a11y, rows = [], foot = null, on, onMood, onReplyDone }) {");
    expect(hero).toContain('data-now-next={r.key === "next" ? "" : undefined}');
    expect(hero).toContain("{MOOD_FACES.map((m) => (");
    expect(home).toContain("const ctx = tier ? { mode: \"reply\", tag: \"СМЕНА ПОЗАДИ ✓\", title: MOOD_TITLE[tier], sub: MOOD_REPLY[tier].text,");
  });
  it("первый день: без плашек «Разминка» и «Шаг дня»; табличка дня — «Первый день» вместо трёх нулей", () => {
    expect(home).toContain("const warm = !firstDay && warmupCard && !(warmupCard.props && warmupCard.props.done) ? warmupCard : null;");
    expect(home).toContain("const step = !firstDay ? stepLine : null;");
    expect(day).toContain("export function DayChips({ a11y, streak, steps = 0, goal = 2, onGoal, today, mastery = null, onMastery, firstDay = false }) {");
    expect(day).toContain("<Val main=\"Первый день\" a11y={a11y} big={17} />");
    // первый день — по всему прогрессу, а не по текущему треку: сменил трек — плашки и «сейчас» остаются
    expect(app).toContain("const firstDay = !Object.keys(completed || {}).length && !Object.keys(quizDone || {}).length && !(streak && streak.count) && !todaySteps;");
    expect(app).toContain("firstDay={firstDay}");
    expect(app).toContain("nowCard={nowCard} nowOn={nowOn} firstDay={firstDay}");
    expect(app).toContain("shift: shiftToday, started: !firstDay, warmReady: warmSits.length >= 2,");
  });
  it("«С возвращением» вместо приветствия по часам; логотип 152×121 (лёжа — как был, 118×94)", () => {
    expect(home).toContain("const hello = nowCard && nowCard.mode === \"back\" ? \"С возвращением\" : h < 6 ? \"Доброй ночи\"");
    expect(home).toContain("style={{ width: short ? 118 : 152, height: short ? 94 : 121, objectFit:\"contain\"");
  });
});

describe("v56: метка и журнал", () => {
  it("метка сборки — v56; CHANGES — «Дополнение 369»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2}<\/span>/);   // v57 — следующая метка
    expect(rd("CHANGES.md")).toContain("# Дополнение 369 — главная: «что сейчас» по смене, «С возвращением», первый день без нулей (v56)");
  });
});
