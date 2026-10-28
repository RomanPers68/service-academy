// v40: «Путь мастера» в приложении — как App.jsx связывает значки, шаг дня, праздники, мастеров заведения,
// приз и ссылки; доступность переходов для шага дня (avail), «новое» у инструментов, ключ мастера в рейтинге,
// сброс на телефоне и этап 26 на сервере (сброс руководителем снимает «Мастера роли»).
// Поведение на экране — в браузере: /home/claude/preview/e2e-v40.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; };
const app = readFileSync("App.jsx", "utf8");   // тесты запускаются из корня проекта

describe("v40: App.jsx — «Путь мастера» подключён", () => {
  it("сброс на телефоне стирает записи «Пути мастера», версия очистки не поднята", () => {
    const list = app.slice(app.indexOf("const wipeLocalProgress = useCallback"), app.indexOf("wipeLocalProgressRef.current = wipeLocalProgress"));
    for (const k of ["sa_life", "sa_mastery", "sa_mastery_sum", "sa_step", "sa_tools_seen", "sa_master_claim"]) expect(list.includes('"' + k + '"'), k).toBe(true);
    expect(app).toMatch(/const WIPE_VERSION = 3;/);
  });
  it("главная — шаг дня и путь мастера (v41: строкой в карточке трека и чипом); «Я» — пункт «Путь мастера» первым; экран лениво", () => {
    // v41 (Доп. 354): карточка MasteryHomeCard под треком «рушила минимализм» — теперь строка и чип
    expect(app).toMatch(/stepLine=\{profile && role && mShown && mStepShown && !mStepShown\.done/);
    expect(app).toMatch(/mastery=\{role && mShown \? masteryChip\(mShown, mNew\.size, a11y\) : null\}/);
    expect(app).toMatch(/const MasteryScreen = lazy\(\(\) => retryImport\(\(\) => import\("\.\/ui\/mastery"\)\)/);
    expect(app).toMatch(/screen === "mastery" && profile/);
    const me = app.slice(app.indexOf('{screen === "me" && profile'), app.indexOf('{screen === "offline"'));
    expect(me.indexOf('key:"mastery"')).toBeGreaterThan(0);
    expect(me.indexOf('key:"mastery"')).toBeLessThan(me.indexOf('key:"guide"'));
  });
  it("праздник — BadgeToast у корня, не поверх урока и слоёв; отмечается сразу", () => {
    expect(app).toMatch(/\{mToast \? <BadgeToast/);
    const cond = app.slice(app.indexOf("const mToast = "), app.indexOf("const ackBadge"));
    for (const w of ["layers.length === 0", "!welcome", "!newAchievement", "!celebrate", '"roleSelect"', '"home"', '"module"', '"me"']) expect(cond.includes(w), w).toBe(true);
    // только на спокойных экранах: не посреди урока, теста, колоды, работы над ошибками
    for (const w of ['"lesson"', '"exam"', '"mistakes"', '"menuTrainer"', '"weeklyGuest"']) expect(cond.includes(w), w).toBe(false);
    expect(app).toMatch(/saveEarned\(ukP, mergeEarned\(readEarned\(ukP\), \[it\], todayKey\)\)/);
    // первый запуск v40 — заработанное раньше молча
    expect(app).toMatch(/if \(earned\.first\) \{ saveEarned\(ukP, mergeEarned\(earned, news\.filter\(\(n\) => n\.kind !== "master"\), todayKey\)\); return news\.filter\(\(n\) => n\.kind === "master"\); \}/);
    // и не сразу: сервер успевает прислать прогресс
    expect(app).toMatch(/setTimeout\(\(\) => setMT\(1\), 6000\), b = setTimeout\(\(\) => setMT\(2\), 20000\)/);
    expect(app).toMatch(/const mReady = mT >= 2 \|\| \(mT >= 1 && customLoaded\);/);
  });
  it("мастера заведения — в рейтинг, лигу, баннер «Команды»; приз; заявка на сервер один раз на роль", () => {
    expect(app).toMatch(/<LeaderboardScreen[^>]*masters=\{mastersIdx\}/);
    expect(app).toMatch(/<LeagueScreen[^>]*masters=\{mastersIdx\}/);
    expect(app).toMatch(/<MastersBanner a11y=\{a11y\} rows=/);
    expect(app).toMatch(/rpc\("mastery_list"/);
    expect(app).toMatch(/rpc\("mastery_prize_set", \{ p_token: saToken\(\), p_text:/);
    expect(app).toMatch(/rpc\("mastery_claim", \{ p_token: saToken\(\), p_role: role, p_have: Math\.max\(need, mState\.master\.have \| 0\), p_need: need \}\)/);
    expect(app).toMatch(/"sa_master_claim" \+ ukP/);
  });
  it("ссылки: из бота ?go=mastery, из Наставника [[go:mastery]], из гида; шаг дня — в напоминании", () => {
    expect(app).toMatch(/"probe", "mastery"[^\]]*\]\.includes\(v\)/);   // v81: дальше в списке — "mistakes", v82 — "brief"
    expect(app).toMatch(/else if \(g === "mastery"\) openMastery\(\);/);
    expect(app).toMatch(/if \(k === "mastery"\)/);
    expect(app).toMatch(/else if \(dest === "mastery"\) openMastery\(\);/);
    expect(app).toMatch(/<RemindSheet[^>]*step=\{mStep && !mStep\.done \? stepLineText\(mStep\) : ""\}/);
    expect(app).toMatch(/mastery: mShown \? \{ bronze: mShown\.bronze/);
  });
  it("переходы шага дня и «Показать ›» — все ключи из lib/mastery.js", async () => {
    const { FAMILIES, FIRST_WEEK } = await import("../lib/mastery.js");
    const fn = app.slice(app.indexOf("const runMasteryGo = useCallback"), app.indexOf("// «новое» гаснет"));
    const keys = new Set([...FAMILIES.map((f) => f.go), ...FIRST_WEEK.map((m) => m.go), "refresh", "gold"]);
    keys.delete("track");   // «track» — ветка по умолчанию
    for (const k of keys) expect(fn.includes('case "' + k + '"'), k).toBe(true);
  });
  it("правила «Раунда мастера» — настоящее число заданий, а не всегда 8", () => {
    expect(app).not.toMatch(/GOLD_N \+ " заданий, на каждое "/);
    expect(app).toMatch(/gN \+ " " \+ pl3\(gN, "задание", "задания", "заданий"\) \+ ", на каждое "/);
  });
  it("метка сборки — v40 или новее (v41 — Доп. 354)", () => {
    expect(readFileSync("ui/menu-trainer.jsx", "utf8")).toMatch(/· сборка v\d{2,}</);
    expect(readFileSync("CHANGES.md", "utf8")).toMatch(/# Дополнение 353 — «Путь мастера»/);
  });
});

describe("v40: шаг дня знает, куда можно позвать (avail)", () => {
  const facts = (life = {}) => ({ life: { st: 0, ...life }, sectionsDone: 1, sectionsTotal: 6, perfectTests: 0, gold: 0, streakBest: 0, questsDone: 0, hallSkills: 0, roleDone: false, firstDay: null, streakNow: 0, mistakesDue: 0, shiftToday: true });
  it("разминать нечего — ни «Попробуй: Разминка», ни задание первой недели «Разомнись»", async () => {
    const M = await import("../lib/mastery.js");
    for (let d = 1; d <= 28; d++) {
      const day = "2026-10-" + String(d).padStart(2, "0");
      const x = facts();
      const st = M.stepOfDay({ state: M.masteryState(x, "seasonal", { now: new Date(2026, 9, d, 12) }), facts: x, uk: "_a" + d, storage: mem(), day, avail: { warmup: false } });
      expect(st.go, day + " " + st.text).not.toBe("warmup");
    }
  });
  it("без avail — как раньше: разминка возможна (первая неделя открыта)", async () => {
    const M = await import("../lib/mastery.js");
    const seen = new Set();
    for (let d = 1; d <= 28; d++) {
      const x = facts();
      const st = M.stepOfDay({ state: M.masteryState(x, "seasonal", { now: new Date(2026, 9, d, 12) }), facts: x, uk: "_b" + d, storage: mem(), day: "2026-10-" + String(d).padStart(2, "0") });
      seen.add(st.go);
    }
    expect(seen.has("warmup")).toBe(true);
  });
  it("«Попробуй» не зовёт туда, где закрыто: avail по ключу перехода", async () => {
    const M = await import("../lib/mastery.js");
    // первая неделя пройдена (все семь), выдохшихся и золотых нет — остаются «Попробуй: …»
    const x = facts({ w: 1, d: 1, p: 1, r: 1, g: 1, m: 1, q: 1 });
    x.firstDay = "2026-09-01";
    const avail = { practice: false, mistakes: false, quest: false, mentor: false, warmup: false };
    for (let d = 1; d <= 20; d++) {
      const st = M.stepOfDay({ state: M.masteryState(x, "seasonal", { now: new Date(2026, 9, d, 12) }), facts: x, uk: "_c" + d, storage: mem(), day: "2026-10-" + String(d).padStart(2, "0"), avail });
      expect(["practice", "mistakes", "quest", "mentor", "warmup"].includes(st.go), st.text).toBe(false);
    }
  });
});

describe("v40: «новое» и мастера заведения (lib/mastery.js)", () => {
  it("«новое» — инструмент без счёта и ступени, пока его не открывали; открыл — погасло", async () => {
    const M = await import("../lib/mastery.js");
    const st = mem();
    const x = { life: { r: 0, g: 2 }, sectionsDone: 0, sectionsTotal: 4 };
    const s = M.masteryState(x, "core");
    expect(M.isNewTool(s.families.find((f) => f.id === "radio"), {})).toBe(true);
    expect(M.isNewTool(s.families.find((f) => f.id === "guest"), {})).toBe(false);   // уже пользовался
    expect(M.isNewTool(s.families.find((f) => f.id === "track"), {})).toBe(false);   // не инструмент
    expect(M.isNewTool(s.families.find((f) => f.id === "streak"), {})).toBe(false);
    const seen = M.markSeen("_u", "radio", st, "2026-10-15");
    expect(seen).toEqual({ radio: "2026-10-15" });
    expect(M.markSeen("_u", "radio", st, "2026-10-20")).toEqual({ radio: "2026-10-15" });   // первая дата остаётся
    expect(M.isNewTool(s.families.find((f) => f.id === "radio"), M.readSeen("_u", st))).toBe(false);
    expect(M.newTools(s, M.readSeen("_u", st)).has("radio")).toBe(false);
    expect(M.newTools(s, {}).has("radio")).toBe(true);
  });
  it("ключ мастера — слова имени без порядка, регистра и «ё»; роли и подпись знака", async () => {
    const M = await import("../lib/mastery.js");
    expect(M.masterKey("Екатерина", "Заяц")).toBe(M.masterKey("Заяц", "Екатерина"));
    expect(M.masterKey("Пётр", "Ёлкин")).toBe(M.masterKey("петр", "елкин"));
    const idx = M.mastersIndex([{ who: "Анна Смирнова", role: "core" }, { who: "Анна Смирнова", role: "seasonal" }, { who: "Иван Петров", role: "bar" }, null, { who: "", role: "core" }]);
    expect(M.masterRolesOf(idx, "Смирнова", "Анна")).toEqual(["core", "seasonal"]);
    expect(M.masterRolesOf(idx, "Олег", "Петров")).toBe(null);
    expect(M.masterTitle(["bar"])).toBe("Мастер роли «Бар»");   // v73: без ✦ (знак у имени — прежний)
    expect(M.masterTitle(["core", "seasonal"])).toBe("Мастер ролей «Ядро», «Новичок»");
    expect(M.masterTitle([])).toBe("Мастер роли");
  });
  it("тексты: «Раунд мастера» в «как получить», «Бронза в 10 значках»", async () => {
    const M = await import("../lib/mastery.js");
    expect(M.FAMILIES.find((f) => f.id === "gold").how).toBe("Сыграй «Раунд мастера» по пройденной теме: 8 заданий на время, не больше одной ошибки.");
    const s = M.masteryState({ life: {}, sectionsDone: 0, sectionsTotal: 3 }, "core");
    expect(s.master.parts.find((p) => p.id === "bronze").label).toBe("Бронза в 10 значках");
  });
});

describe("v40: этап 26 — сброс руководителем снимает «Мастера роли»", () => {
  const sql = readFileSync("supabase/supabase-stage26-mastery.sql", "utf8");
  it("таблица сбросов есть и без этапа 20, закрыта", () => {
    expect(sql).toMatch(/create table if not exists player_resets \(/);
    expect(sql).toMatch(/alter table player_resets enable row level security;/);
  });
  it("список мастеров не показывает сброшенных после того, как стали мастером", () => {
    const list = sql.slice(sql.indexOf("create or replace function mastery_list"), sql.indexOf("create or replace function mastery_prize_set"));
    expect(list).toMatch(/not exists \(select 1 from player_resets pr[\s\S]*pr\.reset_at > m\.at\)/);
  });
  it("снова стал мастером после сброса — запись обновляется (новая дата, сообщение команде)", () => {
    const claim = sql.slice(sql.indexOf("create or replace function mastery_claim"), sql.indexOf("create or replace function mastery_list"));
    expect(claim).toMatch(/on conflict \(emp_id, role\) do update set at = now\(\)[\s\S]*where exists \(select 1 from player_resets pr[\s\S]*pr\.reset_at > sa_masters\.at\)/);
    expect(claim).not.toMatch(/on conflict \(emp_id, role\) do nothing/);
  });
});

describe("v40 (после ревью): новый телефон, шаг дня при смене роли, строка шага для бота", () => {
  it("restoreFromCopy: счётчики — большее, первый день — самый ранний; значки — объединение; повтор — ничего", async () => {
    const M = await import("../lib/mastery.js");
    const st = mem();
    st.setItem("sa_life_r", JSON.stringify({ w: 2, st: 5, since: "2026-10-10" }));
    const copy = { life: { w: 7, r: 3, st: 2, since: "2026-08-01" }, tiers: { warmup: 2, radio: 1, bogus: 3, gold: 9 }, fw: true, master: ["core"] };
    expect(M.restoreFromCopy("_r", copy, st, "2026-10-15")).toBe(true);
    const life = JSON.parse(st.getItem("sa_life_r"));
    expect([life.w, life.r, life.st, life.since]).toEqual([7, 3, 5, "2026-08-01"]);
    expect(JSON.parse(st.getItem("sa_mastery_r"))).toEqual({ tiers: { warmup: 2, radio: 1, gold: 3 }, fw: true, master: { core: "2026-10-15" } });
    expect(M.restoreFromCopy("_r", copy, st, "2026-10-16")).toBe(false);   // уже всё есть
    // отпразднованное на телефоне выше копии — не понижается
    st.setItem("sa_mastery_r", JSON.stringify({ tiers: { warmup: 3 }, fw: false, master: {} }));
    M.restoreFromCopy("_r", { tiers: { warmup: 1 } }, st);
    expect(JSON.parse(st.getItem("sa_mastery_r")).tiers.warmup).toBe(3);
    // пустая или старая копия (без «Пути мастера») — ничего не пишем
    expect(M.restoreFromCopy("_n", null, st)).toBe(false);
    expect(M.restoreFromCopy("_n", { tiers: {} }, st)).toBe(false);
    expect(st.getItem("sa_mastery_n")).toBe(null);
  });
  it("App: восстановление только на «чистом» телефоне и только из копии свежее сброса", () => {
    const fx = app.slice(app.indexOf("// Новый телефон (или очищенный Telegram)"), app.indexOf("// свои результаты тестов: в scores"));
    expect(fx).toMatch(/localStorage\.getItem\("sa_life" \+ ukP\) == null && localStorage\.getItem\("sa_mastery" \+ ukP\) == null/);
    expect(fx).toMatch(/restoreRef\.current\[ukP\] = fresh \? "fresh" : "no";/);   // проверка — до первой записи sa_life
    expect(fx).toMatch(/rpc\("report_person", \{ p_token: saToken\(\), p_emp: "" \}\)/);
    expect(fx).toMatch(/if \(resetAt && \(!copyAt \|\| resetAt >= copyAt\)\) return;/);
    expect(fx).toMatch(/restoreFromCopy\(u, ms\)/);
  });
  it("шаг дня: сменил роль в тот же день — выбирается заново; та же роль — тот же шаг", async () => {
    const M = await import("../lib/mastery.js");
    const st = mem();
    const x = { life: {}, sectionsDone: 0, sectionsTotal: 5, firstDay: "2026-09-01" };
    const s = M.masteryState(x, "core");
    const a = M.stepOfDay({ state: s, facts: x, uk: "_s", storage: st, day: "2026-10-15", role: "core", next: { mod: { id: "c1" }, lesson: { id: "c1-1", title: "Урок ядра" } } });
    const a2 = M.stepOfDay({ state: s, facts: x, uk: "_s", storage: st, day: "2026-10-15", role: "core", next: { mod: { id: "c9" }, lesson: { id: "c9-1", title: "Другой" } } });
    expect(a2.id).toBe(a.id);
    const b = M.stepOfDay({ state: s, facts: x, uk: "_s", storage: st, day: "2026-10-15", role: "bar", next: { mod: { id: "b1" }, lesson: { id: "b1-1", title: "Урок бара" } } });
    expect(JSON.parse(st.getItem("sa_step_s")).role).toBe("bar");
    expect(b.day).toBe("2026-10-15");
    // старый вызов без роли — как раньше (шаг дня не пересчитывается)
    const c = M.stepOfDay({ state: s, facts: x, uk: "_s", storage: st, day: "2026-10-15" });
    expect(c.id).toBe(b.id);
  });
  it("строка шага для бота и Наставника: со строчной, без «Попробуй:» и «Следующий шаг:»", async () => {
    const { stepLineText } = await import("../lib/mastery.js");
    expect(stepLineText({ text: "Попробуй: Радио в дорогу" })).toBe("попробуй «Радио в дорогу»");
    expect(stepLineText({ text: "Следующий шаг: «Подача вина»" })).toBe("урок «Подача вина»");
    expect(stepLineText({ text: "Раунд мастера: «Вино»" })).toBe("раунд мастера по теме «Вино»");
    expect(stepLineText({ text: "Освежи тему «Встреча гостя»" })).toBe("освежи тему «Встреча гостя»");
    expect(stepLineText({ text: "Ещё 3 разминки до серебра «Разминка до смены»" })).toBe("ещё 3 разминки до серебра «Разминка до смены»");
    expect(stepLineText(null)).toBe("");
    // в копию на сервер — только несделанный шаг дня, одной строкой
    expect(app).toMatch(/saveSummary\(ukP, mState, mStep && !mStep\.done \? \{ \.\.\.mStep, text: stepLineText\(mStep\) \} : null\)/);
  });
  it("App: показ — значки не отнимаются (кроме «Трека»), «Мастер роли» с прошлого раза; «новое» — где есть что делать", () => {
    const fx = app.slice(app.indexOf("const mShown = useMemo"), app.indexOf("// «Практика у стола» и «Живой диалог» из шага дня"));
    expect(fx).toMatch(/if \(f\.id === "track" \|\| t <= f\.tier\) return f;/);
    expect(fx).toMatch(/!!\(role && e\.master && e\.master\[role\]\)/);
    expect(app).toMatch(/\.\.\.\(fadedIds\.size \? \{\} : \{ fresh: mSeen\.fresh \|\| "—" \}\), \.\.\.\(goldReady \? \{\} : \{ gold: mSeen\.gold \|\| "—" \}\)/);
    expect(app).toMatch(/<StepLine a11y=\{a11y\} step=\{mStepShown\} onStep=\{\(s\) => runMasteryGo\(s\.go, s\.payload\)\} \/>/);   // v41
  });
  it("App: ждём уроки самой роли (свои разделы приезжают раньше); этапа 26 нет — не спрашиваем снова", () => {
    expect(app).toMatch(/if \(!profile \|\| !storageLoaded \|\| \(role && !modules\.length\)\) return null;/);
    expect(app).toMatch(/if \(g === "mastery" && role && !modules\.length\) return;/);
    expect(app).toMatch(/if \(rpcMissing\(r\)\) \{ m26Ref\.current\.list = true;/);
    expect(app).toMatch(/if \(rpcMissing\(r\)\) \{ m26Ref\.current\.claim = true; return; \}/);
  });
});
