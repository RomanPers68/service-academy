// v156 (Доп. 480): «Гид» → «Советы в уроках» — руководителю. Владелец (14.11): «Прошел уже 2 урока, и пока не одной подсказки
// не увидел🥺»; на предложение «добавлю руководителю в «Гид» список советов: какие скрыты и почему, и кнопку «Показать снова»» —
// «Да, давай добавим😉». Совет показывается только о том, чем ещё не пользовались: у того, кто открывал почти всё, их почти нет.
// Экран — tools/claude/e2e-v156.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tipStatus, tipOverview, tipReason, resetTips, readTipState, markTipShown, markTipUsed, tipLater, pickLessonTip, featureUsed,
  TIP_NEED, TIP_GROUP, TIP_MAX_SHOWS } from "../lib/lesson-tips";
import { TIP_FEATURES, LESSON_TIPS } from "../data/lesson-tips.js";
import { SERVICE_MANAGER_MODULES } from "../data/modules-service_manager";
import { CORE_MODULES } from "../data/modules-core";

const rd = (p) => readFileSync(p, "utf8");
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear(),
  get length() { return m.size; }, key: (i) => [...m.keys()][i] || null }; };
const TODAY = "2026-11-14";
const ALL_CAN = { mistakes: true, faded: true, goldable: true, warmup: true, shift: true, passed: true, menu: true, voices: true, chefVoice: true, somVoice: true, kbju: true,
  wines: true, spirits: true, noBarcard: true, seat: true, sched: true, chat: true, about: true, thanks: true, cases: true };
const lessonsOf = (mods) => mods.flatMap((m) => m.lessons || []);

describe("v156: что с советом о функции (lib/lesson-tips.js: tipStatus)", () => {
  const st = (o = {}) => ({ day: "", lesson: "", f: "", shown: {}, later: {}, used: {}, ...o });
  it("покажется; уже открывали — с днём или по следу на телефоне; «Не сейчас» — до какого дня; три раза мимо; нечего открыть; не руководителю", () => {
    expect(tipStatus("assistant", st(), { can: ALL_CAN }, TODAY)).toEqual({ kind: "ok" });
    expect(tipStatus("analytics", st({ used: { analytics: "2026-11-13" } }), { isLead: true, can: ALL_CAN }, TODAY)).toEqual({ kind: "used", on: "2026-11-13" });
    expect(tipStatus("assistant", st(), { keys: ["sa_ai_chat_u1"], can: ALL_CAN }, TODAY)).toEqual({ kind: "used", on: "" });
    expect(tipStatus("radio", st({ later: { radio: "2026-11-28" } }), { can: ALL_CAN }, TODAY)).toEqual({ kind: "later", until: "2026-11-28" });
    expect(tipStatus("radio", st({ later: { radio: "2026-11-10" } }), { can: ALL_CAN }, TODAY)).toEqual({ kind: "ok" });
    expect(tipStatus("glossary", st({ shown: { glossary: TIP_MAX_SHOWS } }), { can: ALL_CAN }, TODAY)).toEqual({ kind: "missed" });
    expect(tipStatus("seat", st(), { can: { ...ALL_CAN, seat: false } }, TODAY)).toEqual({ kind: "cant", need: ["seat"] });
    expect(tipStatus("late", st(), { can: { ...ALL_CAN, sched: false, chat: false } }, TODAY)).toEqual({ kind: "cant", need: ["sched", "chat"] });
    expect(tipStatus("analytics", st(), { can: ALL_CAN }, TODAY)).toEqual({ kind: "staff" });
    expect(tipStatus("nope", st(), {}, TODAY)).toEqual({ kind: "none" });
  });
  it("у каждого флага can есть слова «почему нечего открыть»", () => {
    const flags = new Set();
    for (const F of Object.values(TIP_FEATURES)) for (const k of [].concat(F.can || [])) flags.add(k);
    for (const list of Object.values(LESSON_TIPS)) for (const [, , x] of list) for (const k of [].concat((x && x.can) || [])) flags.add(k);
    for (const k of flags) expect([k, typeof TIP_NEED[k]]).toEqual([k, "string"]);
  });
});

describe("v156: советы трека по функциям (lib/lesson-tips.js: tipOverview, tipReason)", () => {
  it("руководитель-сервис: свои функции есть, порядок — покажутся, «Не сейчас», нечего открыть, мимо, уже знакомо; внутри — по первому уроку", () => {
    const state = { day: "", lesson: "", f: "", shown: { glossary: 3 }, later: { reference: "2026-11-20" }, used: { analytics: "2026-11-13", reports: "2026-11-12" } };
    const o = tipOverview({ lessons: lessonsOf(SERVICE_MANAGER_MODULES), state, ctx: { isLead: true, can: { ...ALL_CAN, about: false } }, today: TODAY });
    const kinds = o.rows.map((r) => r.status.kind);
    const order = ["ok", "later", "cant", "missed", "used"];
    expect(kinds.every((k, i) => i === 0 || order.indexOf(kinds[i - 1]) <= order.indexOf(k))).toBe(true);
    const byId = Object.fromEntries(o.rows.map((r) => [r.id, r]));
    expect(byId.analytics.status).toEqual({ kind: "used", on: "2026-11-13" });
    expect(byId.reports.status.kind).toBe("used");
    expect(byId.reference.status).toEqual({ kind: "later", until: "2026-11-20" });
    expect(byId.glossary.status.kind).toBe("missed");
    expect(byId.about.status).toEqual({ kind: "cant", need: ["about"] });
    expect(byId.mastery.status.kind).toBe("ok");
    expect(byId.mastery.lessons[0]).toMatchObject({ id: "sm0-1" });
    expect(byId.mastery.lessons[0].text).toBe(LESSON_TIPS["sm0-1"].find(([f]) => f === "mastery")[1]);
    expect(byId.onboarding.name).toBe("Новички");   // руководителю — его название
    expect(o.total).toBe(o.rows.length);
    expect(o.today).toBeNull();
  });
  it("сотрудник: функций руководителя нет; совет дня уже был — урок и функция", () => {
    const st = memStore();
    markTipShown("_e", "c0-1", "credit", TODAY, st);
    const o = tipOverview({ lessons: lessonsOf(CORE_MODULES), state: readTipState("_e", st), ctx: { isLead: false, can: ALL_CAN }, today: TODAY });
    expect(o.rows.some((r) => TIP_FEATURES[r.id].staff)).toBe(false);
    expect(o.today).toEqual({ lesson: "c0-1", title: lessonsOf(CORE_MODULES).find((l) => l.id === "c0-1").title, f: "credit", name: "Зачёт на опыт" });
  });
  it("совет дня был в уроке другого трека — заголовок из titleOf; руководителю — его название функции", () => {
    const st = memStore();
    markTipShown("_l", "s0-1", "onboarding", TODAY, st);
    const o = tipOverview({ lessons: lessonsOf(SERVICE_MANAGER_MODULES), state: readTipState("_l", st), ctx: { isLead: true, can: ALL_CAN }, today: TODAY,
      titleOf: (id) => (id === "s0-1" ? "Первый день: нормально бояться" : "") });
    expect(o.today).toEqual({ lesson: "s0-1", title: "Первый день: нормально бояться", f: "onboarding", name: "Новички" });
    expect(tipOverview({ lessons: [], state: readTipState("_l", st), ctx: { isLead: false }, today: TODAY }).today).toEqual({ lesson: "s0-1", title: "", f: "onboarding", name: "Первая неделя" });
  });
  it("у совета свой флаг («Вина вашей карты» — только если вина есть): нигде не подходит — нечего открыть", () => {
    const lessons = [{ id: "c6-1", title: "Вина", type: "lesson" }, { id: "c6-1-q", title: "Тест", type: "quiz" }];
    const no = tipOverview({ lessons, state: null, ctx: { can: { ...ALL_CAN, wines: false } }, today: TODAY });
    expect(no.rows.find((r) => r.id === "barcard").status).toEqual({ kind: "cant", need: ["wines"] });
    const yes = tipOverview({ lessons, state: null, ctx: { can: ALL_CAN }, today: TODAY });
    expect(yes.rows.find((r) => r.id === "barcard").status).toEqual({ kind: "ok" });
  });
  it("строка под названием: где покажется или почему скрыт — словами", () => {
    const L = (n) => Array.from({ length: n }, (_, i) => ({ id: "l" + i, title: "Урок " + (i + 1), text: "т" }));
    expect(tipReason({ status: { kind: "ok" }, lessons: L(1) })).toBe("в конце урока «Урок 1»");
    expect(tipReason({ status: { kind: "ok" }, lessons: L(2) })).toBe("в конце урока «Урок 1» и ещё в 1 уроке");
    expect(tipReason({ status: { kind: "ok" }, lessons: L(3) })).toBe("в конце урока «Урок 1» и ещё в 2 уроках");
    expect(tipReason({ status: { kind: "ok" }, lessons: L(12) })).toBe("в конце урока «Урок 1» и ещё в 11 уроках");
    expect(tipReason({ status: { kind: "used", on: "2026-11-13" } })).toBe("уже открывали · 13.11");
    expect(tipReason({ status: { kind: "used", on: "" } })).toBe("уже открывали");
    expect(tipReason({ status: { kind: "later", until: "2026-11-28" } })).toBe("вернётся 28.11");
    expect(tipReason({ status: { kind: "missed" } })).toBe("3 раза без нажатия, больше не покажется");
    expect(tipReason({ status: { kind: "cant", need: ["sched", "chat"] } })).toBe("тебя нет в графике этого месяца, чат смены ещё не работает");
    expect(TIP_GROUP).toEqual({ ok: "Покажутся", later: "«Не сейчас»", cant: "Пока нечего открыть", missed: "Пропущены три раза", used: "Уже знакомо" });
  });
});

describe("v156: «Показать советы снова» (lib/lesson-tips.js: resetTips)", () => {
  it("всё с нуля и день сброса; прежние следы (ключи, «Путь мастера») не прячут советы, открытое после — прячет", () => {
    const st = memStore();
    markTipUsed("_m", ["analytics", "mastery"], "2026-11-12", st);
    tipLater("_m", "radio", "2026-11-12", st);
    markTipShown("_m", "sm0-2", "reports", TODAY, st);
    const ctx = { isLead: true, keys: ["sa_ai_chat_x", "sa_recent_q"], seen: { fixes: "2026-11-01" }, famUsed: new Set(["fresh"]), can: ALL_CAN };
    expect(featureUsed("assistant", readTipState("_m", st), ctx)).toBe(true);
    const v = resetTips("_m", TODAY, st);
    expect(v).toEqual({ day: "", lesson: "", f: "", shown: {}, later: {}, used: {}, fresh: TODAY });
    const s1 = readTipState("_m", st);
    expect(s1.fresh).toBe(TODAY);
    for (const f of ["assistant", "search", "mistakes", "fresh", "analytics", "mastery"]) expect([f, featureUsed(f, s1, ctx)]).toEqual([f, false]);
    // открыл «Аналитику» после сброса — совет о ней снова спрятан; отметка сброса остаётся
    markTipUsed("_m", ["analytics"], TODAY, st);
    const s2 = readTipState("_m", st);
    expect(featureUsed("analytics", s2, ctx)).toBe(true);
    expect(s2.fresh).toBe(TODAY);
    tipLater("_m", "mastery", TODAY, st);
    markTipShown("_m", "sm0-1", "mastery", TODAY, st);
    expect(readTipState("_m", st).fresh).toBe(TODAY);
  });
  it("тот, кто открывал почти всё: до сброса в уроке совета нет, после — есть", () => {
    const st = memStore();
    const used = Object.keys(TIP_FEATURES);
    markTipUsed("_o", used, "2026-11-12", st);
    const ctx = { isLead: true, keys: [], can: ALL_CAN };
    expect(pickLessonTip({ lessonId: "sm0-1", state: readTipState("_o", st), ctx, today: TODAY })).toBeNull();
    resetTips("_o", TODAY, st);
    expect(pickLessonTip({ lessonId: "sm0-1", state: readTipState("_o", st), ctx, today: TODAY })).toMatchObject({ id: "analytics", lesson: "sm0-1" });
  });
  it("старое состояние без отметки сброса читается как раньше", () => {
    const st = memStore();
    st.setItem("sa_tips__x", JSON.stringify({ day: "2026-11-13", lesson: "s0-1", f: "league", shown: { league: 1 }, later: {}, used: {} }));
    expect(readTipState("_x", st)).toEqual({ day: "2026-11-13", lesson: "s0-1", f: "league", shown: { league: 1 }, later: {}, used: {} });
  });
});

describe("v156: экран и проводка", () => {
  it("«Гид»: карточка «Советы в уроках» — сводка, группы, строка «почему», текст совета по тапу, «Показать советы снова»", () => {
    const G = rd("ui/guide.jsx");
    expect(G).toContain("export function GuideScreen({ T, a11y, profile, onBack, onOpen, focus = null, tips = null, onTipsReset = null }) {");
    expect(G).toContain("{tips ? <GuideTips tips={tips} onReset={onTipsReset} frost={frost} gold={gold} text={text} sub={sub} a11y={a11y} /> : null}");
    expect(G).toContain('{rows.length ? "покажутся " + okN + " · скрыто " + (rows.length - okN) : "в уроках твоего трека советов нет"}');
    expect(G).toContain("Сегодня совет уже был: «{tips.today.name}» в уроке «{tips.today.title}». Следующий будет завтра.");
    expect(G).toContain('data-guide-tip-why="" style={{ fontSize: 12.5, color: sub, lineHeight: 1.45, marginTop: 2 }}>{tipReason(r)}</div>');
    expect(G).toContain('<span style={{ color: sub }}>Урок «{l0.title}»: </span>{l0.text}');
    expect(G).toContain("Показать советы снова");
    expect(G).toContain('"Готово: советы снова появятся в уроках, по одному в день."');
  });
  it("App: список — только руководителю и только на «Гиде»; сброс — и совет в уроке пересчитывается", () => {
    const A = rd("App.jsx");
    expect(A).toContain('if (!isLead || screen !== "guide") return null;');
    expect(A).toContain("tipOverview({ lessons: programAllMods.flatMap((m) => (m && m.lessons) || []), state: readTipState(ukP), ctx: tipCtx, titleOf: feedTitleOf })");
    expect(A).toContain("const resetTipsAll = useCallback(() => { try { resetTips(ukP); } catch (e) {} setTipVer((v) => v + 1); }, [ukP]);");
    expect(A).toContain("onOpen={openDest} tips={guideTips} onTipsReset={resetTipsAll} />");
  });
});

describe("v156: метка и журнал", () => {
  it("метка «сборка v156», Дополнение 480 со словами владельца, e2e-v156 в README", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    expect(n[0]).toBeGreaterThanOrEqual(156);   // v157: метка дальше — номер последней версии сверяет tests/v157.test.js
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 480 — .*\(v156\)/);
    expect(c).toContain("Прошел уже 2 урока, и пока не одной подсказки не увидел");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v156.mjs` — v156 (Доп. 480)");
  });
});
