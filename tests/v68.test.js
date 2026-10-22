// v68 (Доп. 381): главная карточка «Приглашение» и свеча, которая не спорит с бокалом.
// Владелец: «что ещё можно сделать, чтобы главный экран был удобнее и чтобы глазу приятно было?» Из показанных
// вариантов выбрано «Приглашение»: «белая — для светлой темы, тёмная — для тёмной»; кнопку на чёрной карте —
// «кружок-значок», «сделаем его линзой, как кнопка AI». И его снимок: «0 дней подряд» рядом с «цель дня 1/1».
// Вид в браузере — tools/claude/e2e-v68.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: () => null, length: 0 };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { fresherStreak, liveStreak, nextStreak } from "../lib/streak.js";
import { NowInvitation, nowLead } from "../ui/now-hero";
import { WarmupCard } from "../ui/day-cards";
import { StepLine } from "../ui/mastery-card";

const rd = (f) => readFileSync(f, "utf8");
const noop = () => {};
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const text = (html) => html.replace(/<[^>]+>/g, "");
const inner = (html, attr) => { const at = html.indexOf(attr); return at < 0 ? null : html.slice(html.indexOf(">", at) + 1, html.indexOf("</", at)); };
const T4 = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false,
  roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };
const d = (s, hh = 12) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd, hh, 0, 0); };

describe("v68: серия — свежее из двух и «на сейчас»", () => {
  it("fresherStreak: позже последний день — та; при равном — больше дней; пусто — пустая серия", () => {
    const a = { count: 3, last: "2026-10-21" }, b = { count: 1, last: "2026-10-22" }, c = { count: 5, last: "2026-10-21" };
    expect(fresherStreak(a, b)).toBe(b);
    expect(fresherStreak(b, a)).toBe(b);
    expect(fresherStreak(a, c)).toBe(c);
    expect(fresherStreak(c, a)).toBe(c);
    expect(fresherStreak(null, a)).toBe(a);
    expect(fresherStreak(a, "мусор")).toBe(a);
    expect(fresherStreak(null, undefined)).toEqual({ count: 0, best: 0, last: "", days: [] });
  });
  it("liveStreak: сегодня — горит; вчера — жива, ждёт; прервалась — 0; выходные по графику не обрывают", () => {
    const now = d("2026-10-22");
    expect(liveStreak({ count: 4, last: "2026-10-22" }, now)).toEqual({ count: 4, lit: true });
    expect(liveStreak({ count: 4, last: "2026-10-21" }, now)).toEqual({ count: 4, lit: false });
    expect(liveStreak({ count: 4, last: "2026-10-19" }, now)).toEqual({ count: 0, lit: false });
    const off = (dt) => [20, 21].includes(dt.getDate());   // 20 и 21 — выходные по графику
    expect(liveStreak({ count: 4, last: "2026-10-19" }, now, off)).toEqual({ count: 4, lit: false });
    expect(liveStreak({ count: 0, last: "2026-10-22" }, now)).toEqual({ count: 0, lit: false });
    expect(liveStreak(null, now)).toEqual({ count: 0, lit: false });
    expect(liveStreak({ count: 2, last: "2026-10-30" }, now)).toEqual({ count: 2, lit: false });   // часы ушли назад
  });
  it("серия от свежей записи: шаг после входа без перезапуска продолжает настоящую серию, а не начинает с 1", () => {
    const now = d("2026-10-22");
    const inMemory = { count: 0, best: 0, last: "", days: [] }, onPhone = { count: 6, best: 9, last: "2026-10-21", days: ["2026-10-21"] };
    expect(nextStreak(fresherStreak(inMemory, onPhone), now, () => null).count).toBe(7);
    expect(nextStreak(inMemory, now, () => null).count).toBe(1);   // как было: серия начиналась заново
  });
});

describe("v68: App — свеча и бокал говорят одно", () => {
  const app = rd("App.jsx");
  it("touchStreak считает от более свежей серии — в памяти или на телефоне", () => {
    expect(app).toContain('import { nextStreak, fresherStreak, liveStreak, dayOffFromSchedule, myShiftOn, shiftLabel, ymd } from "./lib/streak";');
    expect(app).toContain('try { saved = JSON.parse(localStorage.getItem("sa_streak" + uk) || "null"); } catch(e) { saved = null; }');
    expect(app).toContain("const prev = fresherStreak(streakRef.current, saved);");
  });
  it("шаг сегодня есть, а свеча не горит — зажигается сама; табличка — серия «на сейчас»", () => {
    expect(app).toContain("const todayLit = !!(todayRec && ((Number(todayRec.st) || 0) > 0 || (Number(todayRec.f) || 0) > 0));");
    expect(app).toMatch(/if \(!profile \|\| !storageLoaded \|\| !todayLit\) return;\n\s*if \(streak && streak\.last === todayKey\) return;\n\s*touchStreak\(\);/);
    expect(app).toContain("const lv = liveStreak(streak, new Date(), (d) => dayOffFromSchedule(profile, d));");
    expect(app).toContain("dayStrip={profile ? <DayChips a11y={a11y} streak={streakLive} steps={todaySteps}");
  });
  it("вход по коду без перезапуска — серия, ошибки, избранное и экзамены читаются с телефона; сброс чистит и журнал дня", () => {
    expect(app).toMatch(/loadLocalFor\(prof\);[^\n]*\n\s*startBoot\(token \|\| "demo"\);[^\n]*\n\s*setProfile\(prof\);/);
    for (const k of ["sa_quiz_done", "sa_completed_roles", "sa_completed", "sa_last_role", "sa_streak", "sa_mistakes", "sa_saved", "sa_exam"]) expect(app).toContain('get("' + k + '" + uk)');
    expect(app).toContain("streakRef.current = st; setStreak(st);");
    expect(app).toContain('setActivity({}); setWarmDone("");');
  });
});

describe("v68: «Приглашение» — белая бумага в светлой теме, чёрная карта в тёмной", () => {
  const before = { mode: "before", mins: 26, from: 11, to: 24, title: "Разминка перед сменой", sub: "3 вопроса · 2 мин — освежишь главное", cta: "Начать", action: "warmup", icon: "clock" };
  const rows = [{ key: "next", label: "Дальше:", title: "Тест «Философия сервиса»", onClick: noop }];
  it("тёмная — чёрная карта: золотое тиснение заголовка, на корешке линза, как кнопка AI, и «Начать»", () => {
    const html = R(h(NowInvitation, { ctx: before, a11y: false, rows, on: {} }));
    expect(html).toContain('data-now-card="before"');
    expect(html).toContain('data-hero="black"');
    expect(html).toContain("data-now-lens");
    expect(html).not.toContain("data-now-seal");
    expect(html).toMatch(/data-now-title="" style="[^"]*background-clip:text/);
    expect(inner(html, "data-now-title")).toBe("Разминка перед сменой");
    expect(inner(html, "data-now-tag")).toBe("До смены 26 мин");
    expect(inner(html, "data-now-cta")).toBe("Начать");
    expect(text(html)).toContain("2 мин");
    expect(html).toContain('aria-label="До смены 26 мин. Разминка перед сменой. Начать"');
    // линза — то же стекло, что у кнопки AI (ui/tabbar.jsx AiDisc)
    const tab = rd("ui/tabbar.jsx"), hero = rd("ui/now-hero.jsx");
    for (const part of ["rgba(200,169,110,0.12)", "inset 0 0 0 1px rgba(214,178,102,0.45), inset 0 0 18px rgba(255,230,170,0.12), inset 0 1.5px 0 rgba(255,255,255,0.18)"]) {
      expect(hero).toContain(part);
      expect(tab.replace(/\$\{a11y \? "[^"]*" : "([^"]*)"\}/g, "$1")).toContain(part);
    }
  });
  it("светлая — белая бумага с сургучной печатью; вырезы по линии отрыва — маской", () => {
    const html = R(h(NowInvitation, { ctx: before, a11y: true, rows, on: {} }));
    expect(html).toContain('data-hero="paper"');
    expect(html).toContain("data-now-seal");
    expect(html).not.toContain("data-now-lens");
    expect(html).toContain("#FFFDF8");
    expect(html).toMatch(/mask:radial-gradient\(circle at calc\(100% - 100px\) 0, transparent 9px/);
  });
  it("строки внизу: «Дальше», «Разминка», «Шаг дня»; подсказка — под карточкой", () => {
    const html = R(h(NowInvitation, { ctx: before, a11y: false, rows: [...rows, { key: "step", label: "Шаг дня:", title: "Квест смены", onClick: noop }],
      foot: h("div", { "data-test-foot": "" }, "Напоминать в Telegram"), on: {} }));
    const n = html.indexOf('data-now-row="next"'), s = html.indexOf('data-now-row="step"');
    expect(html).toContain('data-now-next=""');
    expect(n).toBeGreaterThan(html.indexOf("data-now-title"));
    expect(s).toBeGreaterThan(n);
    expect(html.indexOf("data-test-foot")).toBeGreaterThan(html.indexOf("data-now-stub"));
  });
  it("все случаи: на смене, после смены (лица, без нажатия на карточку), ответ, возвращение, обычный день", () => {
    expect(nowLead({ mode: "during", to: 24 })).toBe("На смене до 24:00");
    expect(nowLead({ mode: "after" })).toBe("Смена позади");
    expect(nowLead({ mode: "reply" })).toBe("Смена позади ✓");
    expect(nowLead({ mode: "back" })).toBe("С возвращением");
    expect(nowLead({ mode: "track", lead: "Хостес · пройдено 8%" })).toBe("Хостес · пройдено 8%");
    expect(nowLead({ mode: "before", mins: 100 })).toBe("До смены 1 ч 40 мин");
    const mood = R(h(NowInvitation, { ctx: { mode: "after", to: 20, title: "Как прошла смена?", sub: "отметь одним касанием", cta: null, action: "mood", icon: "moon" }, a11y: false, on: {} }));
    expect(mood).toContain("data-now-moods");
    expect(mood).not.toContain('role="button" tabindex="0" data-now-card');
    expect(mood).not.toContain("data-now-cta");
    const reply = R(h(NowInvitation, { ctx: { mode: "reply", title: "Хорошая смена ✦", sub: "Отлично!", cta: "Рассказать", action: "ask", ask: "?", icon: "moon" }, a11y: true, on: {} }));
    expect(reply).toContain("data-now-later");
    expect(inner(reply, "data-now-cta")).toBe("Рассказать");
  });
});

describe("v68: главная — «Приглашение» на месте карточки трека", () => {
  const mod = { id: "cms-m-1", title: "Свой раздел", lessons: [{ id: "cms-l-1", type: "lesson", title: "Урок: встреча гостя", content: "Текст" },
    { id: "cms-l-2", type: "quiz", title: "Тест: встреча гостя", questions: [{ q: "?", options: ["а", "б"], correct: 0 }] }] };
  const profile = { name: "Роман", surname: "Смирнов", restaurant: "Два моря, Океан", position: "waiter" };
  const STEP = { id: "try:quest", kind: "try", fam: "quest", text: "Попробуй: Квест смены", sub: "", go: "quest" };
  const render = async (extra = {}) => {
    const { RoleSelect } = await import("../ui/screens-roleselect");
    return R(h(RoleSelect, { T: T4, a11y: false, profile, role: "seasonal", onSelect: noop, onContinueLesson: noop, onGuestBook: noop, onSchedule: noop, onMistakes: noop, customByRole: { seasonal: [mod] }, ...extra }));
  };
  const now = { mode: "before", mins: 26, from: 11, to: 24, title: "Разминка перед сменой", sub: "3 вопроса · 2 мин — освежишь главное", cta: "Начать", action: "warmup", icon: "clock" };
  it("«сейчас» — карточка «Приглашение» со строкой «Дальше» к следующему шагу трека", async () => {
    const html = await render({ nowCard: now, nowOn: { warmup: noop }, completed: { "cms-l-1": true } });
    expect(html).toContain('data-now-card="before"');
    expect(inner(html, "data-now-tag")).toBe("До смены 26 мин");
    const row = html.indexOf('data-now-row="next"');
    expect(text(html.slice(html.indexOf(">", row) + 1, html.indexOf("</div>", row)))).toBe("Дальше:Тест «Встреча гостя»›");
    expect(html.indexOf("data-now-card")).toBeLessThan(html.indexOf("Мой график"));
  });
  it("обычный день — приглашение к следующему шагу: трек и сколько пройдено, название, «Дальше»; строки разминки и шага", async () => {
    const warm = h(WarmupCard, { compact: true, a11y: false, shift: "", known: false, done: false, onStart: noop });
    const html = await render({ completed: { "cms-l-1": true }, warmupCard: warm, stepLine: h(StepLine, { a11y: false, step: STEP, onStep: noop }) });
    expect(html).toContain('data-now-card="track"');
    expect(inner(html, "data-now-tag")).toBe("Новичок · пройдено 50%");
    expect(inner(html, "data-now-title")).toBe("Тест «Встреча гостя»");
    expect(inner(html, "data-now-cta")).toBe("Дальше");
    const w = html.indexOf('data-now-row="warm"'), s = html.indexOf('data-now-row="step"');
    expect(text(html.slice(html.indexOf(">", w) + 1, html.indexOf("</div>", w)))).toBe("Разминка:2 мин · перед сменой›");
    expect(text(html.slice(html.indexOf(">", s) + 1, html.indexOf("</div>", s)))).toBe("Шаг дня:Квест смены›");
  });
  it("первый день — одно действие: «первый шаг», без строк; трек пройден — «закрепи» или «держи форму»", async () => {
    const first = await render({ firstDay: true, warmupCard: h(WarmupCard, { compact: true, a11y: false, known: false, done: false, onStart: noop }) });
    expect(inner(first, "data-now-tag")).toBe("Новичок · первый шаг");
    expect(inner(first, "data-now-title")).toBe("Урок «Встреча гостя»");
    expect(inner(first, "data-now-cta")).toBe("Начать");
    expect(text(first)).toContain("начни здесь · весь путь ≈");
    expect(first).not.toContain("data-now-row=");
    const all = { completed: { "cms-l-1": true }, quizDone: { "cms-l-2": true } };
    const due = await render({ ...all, mistakeBank: [{ q: "?", due: 0 }, { q: "?", due: 0 }] });
    expect(inner(due, "data-now-title")).toBe("Трек пройден · закрепи");
    expect(inner(due, "data-now-cta")).toBe("Ответить");
    expect(text(due)).toContain("2 вопроса вернулись на повторение");
    const done = await render(all);
    expect(inner(done, "data-now-title")).toBe("Путь пройден · держи форму");
    expect(inner(done, "data-now-cta")).toBe("Принять");
    expect(inner(done, "data-now-tag")).toBe("Новичок · пройдено 100%");
  });
  it("подсказка главной показывает на карточку: ref — на обёртке «Приглашения»", () => {
    expect(rd("ui/screens-roleselect.jsx")).toMatch(/<div ref=\{refTrack\}>\n\s*<NowInvitation key=\{card\.mode\}/);
  });
});

describe("v68: метка и журнал", () => {
  it("«сборка v68», «Дополнение 381»", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v68</span>");
    expect(rd("CHANGES.md")).toContain("# Дополнение 381 — главная карточка «Приглашение», свеча и бокал говорят одно (v68)");
  });
});
