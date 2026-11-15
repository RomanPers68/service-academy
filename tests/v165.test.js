// v165 (Доп. 490): четыре находки с обхода приложения. Владелец (15.11) спросил: «И есть что-то ещё, что возможно ты
// заметил, что требует улучшений?» — и на список из четырёх пунктов ответил: «Да, делаем все».
//   1. Приветствие: на телефонах поуже при имени подлиннее карандаш оставался один на второй строке. Теперь имя и
//      карандаш не разрываются: не влезли рядом с приветствием — переносятся вместе.
//   2. Какой тест сдан: в рейтинге (карточка коллеги) и в «Моей статистике» («Последние тесты») у результата не было
//      названия теста — с сервера оно не приходит. Теперь название берётся из программы; карточка в статистике стоит
//      во всю ширину (была по центру, полоска результата — нулевой ширины); «1 тест», а не «1 тестов». То же в
//      карточке сотрудника у руководителя: заголовком стояла роль, теперь название теста.
//   3. Слово при числе: «31 день», «22 смены», «Сборка · 3 шага», «из 21 урока» — общий счёт lib/ru-num.js.
//   4. Лица в кружках, фото «О нас» и фото в чате, приехавшие уже на открытом экране, проявляются, как обложки
//      разделов (v163), а не встают рывком.
// Сервер не меняется. Разметки JSX в файле нет (Доп. 482).
// Вид в браузере (ширины телефонов, медленная сеть) — tools/claude/e2e-v165.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store0 = {};
const phone = { getItem: (k) => (k in store0 ? store0[k] : null), setItem: (k, v) => { store0[k] = String(v); }, removeItem: (k) => { delete store0[k]; } };
globalThis.localStorage = phone;
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { plural, pluralGen, counted } from "../lib/ru-num";
import { quizTitles, withQuizTitles, scoreDate } from "../lib/team-feed";
import { MODULES_INDEX } from "../data/modules-index";
import { greetName, GREET_GLUE } from "../ui/screens-roleselect";
import { useSoftImg, PHOTO_FADE } from "../ui/lesson-photo";
import { ConceptPhoto, conceptPhotoRemember } from "../ui/concept-photo";
import { StatsScreen } from "../ui/screens-gamification";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html) => html.replace(/<[^>]+>/g, "");
const count = (s, part) => s.split(part).length - 1;
const noop = () => {};
const noPreload = (html) => html.replace(/<link rel="preload"[^>]*>/g, "");   // React 19 на сервере добавляет предзагрузку картинок
const R0 = "Два моря, Океан";

describe("v165 · версия и журнал", () => {
  it("сборка v165, Дополнение 490, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(165);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 490 — .*\(v165\)/);
    const part = c.slice(c.indexOf("# Дополнение 490"));
    const flat = part.replace(/\s+/g, " ");   // слова владельца могут переноситься на новую строку
    expect(flat).toContain("что требует улучшений?");
    expect(flat).toContain("Да, делаем все");
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v165.mjs");
  });
});

// ── 1. приветствие ───────────────────────────────────────────────────────────────────────────────────
const T4 = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false,
  roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };
const mod = { id: "cms-m-1", title: "Свой раздел", lessons: [{ id: "cms-l-1", type: "lesson", title: "Урок: встреча гостя", content: "Текст" }] };
const home = async (name, extra = {}) => {
  const { RoleSelect } = await import("../ui/screens-roleselect");
  return R(h(RoleSelect, { T: T4, a11y: false, profile: { name, surname: "Смирнова", restaurant: R0, position: "waiter" }, role: "seasonal", onSelect: noop, onContinueLesson: noop, onGuestBook: noop,
    onSchedule: noop, onProfile: noop, customByRole: { seasonal: [mod] }, ...extra }));
};
// приветствие: блок от «…, » до названия заведения
const greet = (html) => { const b = html.indexOf(R0); const a = html.lastIndexOf('<div style="color:#fff;font-size:18px', b); return a < 0 ? "" : html.slice(a, b); };
const PENCIL = '<span [^>]*style="display:inline-flex;vertical-align:-2px;margin-left:8px;cursor:pointer;opacity:0\\.65"[^>]*><svg';

describe("v165 · 1: приветствие — карандаш держится за имя (ui/screens-roleselect.jsx)", () => {
  it("имя делится на начало и последнее слово", () => {
    expect(greetName("Анна")).toEqual(["", "Анна"]);
    expect(greetName("Анна Мария")).toEqual(["Анна ", "Мария"]);
    expect(greetName("  Анна   Мария  Луиза ")).toEqual(["Анна Мария ", "Луиза"]);
    expect(greetName("Анна-Мария")).toEqual(["", "Анна-Мария"]);
    expect(greetName("")).toEqual(["", ""]);
    expect(greetName(null)).toEqual(["", ""]);
    expect(greetName(undefined)).toEqual(["", ""]);
    expect(GREET_GLUE).toBe(16);
  });
  it("имя и карандаш — в одной неразрывной обёртке: не влезли в строку — переносятся вместе", async () => {
    const g = greet(await home("Александра"));
    expect(count(g, "data-greet-name")).toBe(1);
    expect(g).toMatch(new RegExp(', <span data-greet-name="" style="white-space:nowrap"><span style="color:[^"]+">Александра</span>' + PENCIL));
    // карандаш один, и он внутри обёртки: после неё в приветствии ничего нет
    expect(count(g, "vertical-align:-2px")).toBe(1);
    expect(g).toMatch(/<\/svg><\/span><\/span><\/div>/);
    expect(text(g)).toMatch(/^(Доброй ночи|Доброе утро|Добрый день|Добрый вечер|С возвращением), Александра$/);
  });
  it("имя из нескольких слов: за карандаш держится последнее, остальные переносятся как текст", async () => {
    const g = greet(await home("Анна Мария"));
    expect(g).toMatch(new RegExp(', <span style="color:[^"]+">Анна </span><span data-greet-name="" style="white-space:nowrap"><span style="color:[^"]+">Мария</span>' + PENCIL));
    expect(text(g)).toMatch(/, Анна Мария$/);
  });
  it("без карандаша и у слова длиннее GREET_GLUE букв — разметка прежняя, обёртки нет", async () => {
    const plain = greet(await home("Александра", { onProfile: undefined }));
    expect(plain).not.toContain("data-greet-name");
    expect(plain).not.toContain("vertical-align:-2px");
    expect(plain).toMatch(/, <span style="color:[^"]+">Александра<\/span><\/div>/);
    const long = "А".repeat(GREET_GLUE + 1);
    const g = greet(await home(long));
    expect(g).not.toContain("data-greet-name");
    expect(g).toMatch(new RegExp(', <span style="color:[^"]+">' + long + "</span>" + PENCIL));
    expect(greet(await home("А".repeat(GREET_GLUE)))).toContain("data-greet-name");
  });
});

// ── 2. какой тест сдан ───────────────────────────────────────────────────────────────────────────────
describe("v165 · 2: название теста у результатов с сервера (lib/team-feed.js, App.jsx)", () => {
  const titleOf = (id) => ({ "s0-q": "Тест: первый день", "c-q": "Свой тест" }[id] || "");
  it("название подставляется по номеру теста; своё название и неизвестный тест не трогаем", () => {
    const rows = [
      { id: 1, quiz_id: "s0-q", quizTitle: "", pct: 100 },
      { id: 2, quiz_id: "s0-q", quizTitle: "Сдан сейчас", pct: 92 },
      { id: 3, quiz_id: "нет-такого", quizTitle: "", pct: 50 },
      { id: 4, quizTitle: "", pct: 10 },
      { id: 5, quiz_id: "c-q", pct: 80 },
    ];
    const out = withQuizTitles(rows, titleOf);
    expect(out.map((s) => s.quizTitle)).toEqual(["Тест: первый день", "Сдан сейчас", "", "", "Свой тест"]);
    expect(out[1]).toBe(rows[1]);   // строка с названием — та же самая
    expect(out[2]).toBe(rows[2]);
    expect(rows[0].quizTitle).toBe("");   // исходный список не меняется
    expect(out[0]).toMatchObject({ id: 1, quiz_id: "s0-q", pct: 100 });
  });
  it("нечего подставлять — тот же список; не список или нет способа узнать название — без падения", () => {
    const rows = [{ id: 1, quiz_id: "x", quizTitle: "Есть" }, { id: 2, quiz_id: "нет", quizTitle: "" }];
    expect(withQuizTitles(rows, titleOf)).toBe(rows);
    expect(withQuizTitles([], titleOf)).toEqual([]);
    expect(withQuizTitles(null, titleOf)).toEqual([]);
    expect(withQuizTitles(rows, null)).toBe(rows);
    expect(withQuizTitles([null, undefined, { quiz_id: "s0-q" }], titleOf)[2].quizTitle).toBe("Тест: первый день");
  });
  it("названия из настоящей программы: у теста первого раздела «Новичка» оно есть", () => {
    const real = quizTitles(MODULES_INDEX, [{ lessons: [{ id: "cms-q-1", title: "Тест своего урока" }] }]);
    expect(real("s0-q")).toBe("Тест: первый день");
    expect(real("cms-q-1")).toBe("Тест своего урока");
    expect(withQuizTitles([{ quiz_id: "s0-q", quizTitle: "" }], real)[0].quizTitle).toBe("Тест: первый день");
  });
  it("дата результата: «15.11.2026»; даты нет или она не разобралась — пусто, а не «Invalid Date»", () => {
    expect(scoreDate(new Date(2026, 10, 15, 12, 0, 0).toISOString())).toBe("15.11.2026");   // полдень по местному времени — день тот же в любом поясе
    expect(scoreDate(new Date(2026, 0, 1, 12, 0, 0).getTime())).toBe("01.01.2026");
    for (const bad of [undefined, null, "", "не дата", NaN]) expect(scoreDate(bad)).toBe("");
  });
  it("App: рейтинг и «Моя статистика» получают результаты с названиями", () => {
    const app = rd("App.jsx");
    expect(app).toContain('import { buildFeed, quizTitles, withQuizTitles, scoreDate } from "./lib/team-feed";');
    expect(app).toContain("const titledScores = useMemo(() => withQuizTitles(liveScores, feedTitleOf), [liveScores, feedTitleOf]);");
    expect(count(app, "scores={titledScores}")).toBe(2);
    expect(app).not.toContain("scores={liveScores}");
    expect(app).toMatch(/<StatsScreen [^\n]*scores=\{titledScores\}/);
    expect(app).toMatch(/<LeaderboardScreen [^\n]*scores=\{titledScores\}/);
    expect(app).toContain("date: scoreDate(s.updated_at),");
    expect(app).not.toContain('date: new Date(s.updated_at).toLocaleDateString("ru-RU")');
  });
});

const T5 = { ...T4, modCard: { display: "flex" }, lessCard: { display: "flex", alignItems: "center", gap: 10 }, lessTitle: { color: "#eee" }, secTitle: { color: "#999" }, para: {}, doneBtn: {} };
const ANNA = { name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter" };
const score = (extra) => ({ id: 1, name: "Анна", surname: "Смирнова", restaurant: R0, role: "seasonal", position: "waiter", quiz_id: "s0-q", quizTitle: "Тест: первый день", score: 11, total: 12, pct: 92, date: "15.11.2026", ...extra });
const stats = (scores) => noPreload(R(h(StatsScreen, { T: T5, a11y: false, profile: ANNA, scores, completedRoles: new Set(), completed: { "s0-1": true }, quizDone: { "s0-q": true }, examResults: {}, practiceStars: {},
  allProfiles: [], onBack: noop })));
// карточки «Последних тестов»: у последней в хвосте остаток экрана — проверкам он не мешает
const lastTests = (html) => html.split("<div data-last-test").slice(1).map((x) => "<div data-last-test" + x);

describe("v165 · 2: «Моя статистика» и карточка коллеги в рейтинге (ui/screens-gamification.jsx)", () => {
  it("«Последние тесты»: название теста, роль и дата; карточка во всю ширину, полоска видна", () => {
    const cards = lastTests(stats([score()]));
    expect(cards.length).toBe(1);
    expect(cards[0]).toMatch(/^<div data-last-test="" style="display:flex;align-items:stretch;gap:4px;margin-bottom:8px;flex-direction:column">/);
    expect(cards[0]).toMatch(/<div data-score-title="" style="[^"]*flex:1;margin-right:8px">Тест: первый день<\/div>/);
    expect(text(cards[0])).toContain("Тест: первый день92%Новичок · 15.11.2026");
    expect(cards[0]).toContain('<div style="width:92%;height:100%;background:#81C784"></div>');
  });
  it("названия нет (урок удалён, чужое заведение) — «Тест»; даты нет — без точки и без «Invalid Date»", () => {
    const html = stats([score({ quizTitle: "", date: "" })]);
    const card = lastTests(html)[0];
    expect(card).toMatch(/<div data-score-title="" [^>]*>Тест<\/div>/);
    expect(text(card)).toContain("Тест92%Новичок");
    expect(text(card)).not.toContain("Новичок ·");
    expect(html).not.toContain("Invalid Date");
  });
  it("не больше пяти последних, свежие первыми; чужие результаты в список не идут", () => {
    const mine = [1, 2, 3, 4, 5, 6, 7].map((k) => score({ id: k, quiz_id: "q" + k, quizTitle: "Тест " + k }));
    const cards = lastTests(stats([...mine, score({ id: 99, name: "Вера", surname: "Соколова", quizTitle: "Чужой тест" })]));
    expect(cards.map((c) => /data-score-title=""[^>]*>([^<]*)</.exec(c)[1])).toEqual(["Тест 7", "Тест 6", "Тест 5", "Тест 4", "Тест 3"]);
  });
  it("«Прогресс по ролям»: «1 тест пройден», «2 теста пройдено», «0 тестов пройдено»", () => {
    expect(text(stats([score()]))).toContain("1 тест пройден");
    expect(text(stats([score()]))).not.toContain("1 тест пройдено");
    expect(text(stats([score(), score({ id: 2, quiz_id: "s1-q" })]))).toContain("2 теста пройдено");
    expect(text(stats([score()]))).toContain("0 тестов пройдено");   // у остальных ролей
  });
  it("карточка коллеги в рейтинге: «1 тест», название теста, дата — только если она есть", () => {
    const g = rd("ui/screens-gamification.jsx");
    expect(g).toContain('<div data-lb-tests="" style={{ color:T.modSub.color, fontSize: T.modSub?.fontSize || 13 }}>{kk(selected?.total, "тест", "теста", "тестов")}</div>');
    expect(g).not.toContain(">тестов</div>");
    expect(g).toContain('<div data-score-title="" style={{ ...T.lessTitle, fontSize:12.5, flex:1, marginRight:8 }}>{d.quizTitle || "Тест"}</div>');
    expect(g).toContain('{d.score} из {d.total} верно{d.date ? " · " + d.date : ""}</div>');
    expect(g).toContain('{[roleLabel[s.role], s.date].filter(Boolean).join(" · ")}</div>');
    expect(g).not.toContain("{d.quizTitle}</div>");
    expect(g).not.toContain("{s.quizTitle}</div>");
  });
  it("карточка сотрудника у руководителя: заголовком название теста (была роль), роль — в подписи, карточка во всю ширину", () => {
    const g = rd("ui/screens-gamification.jsx");
    expect(g).toContain("const PROGRAM_TITLE = quizTitles(MODULES_INDEX);\nexport function PlayerDetailScreen({ player, T, onBack, titleOf = null }) {");
    expect(g).toContain('const title = (s.quiz_id && ((typeof titleOf === "function" && titleOf(s.quiz_id)) || PROGRAM_TITLE(s.quiz_id))) || "Тест";');
    expect(g).toContain('<div key={i} data-player-test="" style={{ ...T.modCard, marginBottom:8, padding:"10px 14px", flexDirection:"column", alignItems:"stretch", gap:4 }}>');
    expect(g).toContain('{[s.role ? roleNames[s.role] || s.role : "", `${s.score} из ${s.total} верно`, scoreDate(s.updated_at)].filter(Boolean).join(" · ")}</div>');
    expect(g).not.toContain("toLocaleDateString(\"ru-RU\")}</div>");   // даты результатов — только через scoreDate
    expect(rd("App.jsx")).toContain("<PlayerDetailScreen player={selectedPlayer} T={T} titleOf={feedTitleOf} onBack=");
    // там же «Прогресс по ролям»: название и процент слипались («Хостес0%»), полоски не было видно
    expect(g).toContain('<div key={roleId} data-player-role={roleId} style={{ ...T.modCard, flexDirection:"column", alignItems:"stretch", gap:8, marginBottom:8, padding:"12px 14px" }}>');
  });
  it("колонкой без своей раскладки остались только плитки статистики (им и положено стоять по центру)", () => {
    // T.modCard и T.lessCard — ряд с выравниванием по центру: карточка-колонка без alignItems сжимает свои строки к середине
    const bad = [];
    for (const f of readdirSync("ui").filter((x) => x.endsWith(".jsx"))) {
      rd("ui/" + f).split("\n").forEach((line, i) => { if (/\.\.\.T\.(modCard|lessCard)[^}]*flexDirection: ?"column"/.test(line) && !/alignItems/.test(line)) bad.push(f + ":" + line.trim().slice(0, 60)); });
    }
    expect(bad.length).toBe(1);
    expect(bad[0]).toMatch(/^screens-gamification\.jsx:<div key=\{i\} ref=\{s\.label === "Ролей завершено"/);
  });
});

// ── 3. слово при числе ───────────────────────────────────────────────────────────────────────────────
describe("v165 · 3: слово при числе (lib/ru-num.js)", () => {
  const W = ["шаг", "шага", "шагов"];
  it("именительный счёт: 1 шаг, 2–4 шага, 5–20 шагов, 21 шаг, 22 шага, 111 шагов", () => {
    const want = { 0: "шагов", 1: "шаг", 2: "шага", 3: "шага", 4: "шага", 5: "шагов", 9: "шагов", 10: "шагов", 11: "шагов", 12: "шагов", 13: "шагов", 14: "шагов", 15: "шагов", 19: "шагов", 20: "шагов",
      21: "шаг", 22: "шага", 24: "шага", 25: "шагов", 30: "шагов", 31: "шаг", 100: "шагов", 101: "шаг", 102: "шага", 111: "шагов", 112: "шагов", 114: "шагов", 121: "шаг", 1001: "шаг" };
    for (const [n, w] of Object.entries(want)) expect([n, plural(Number(n), ...W)]).toEqual([n, w]);
  });
  it("родительный счёт (после «из», «не хватит»): из 1 смены, из 21 смены, из 2, 5, 11, 22 смен", () => {
    const want = { 0: "смен", 1: "смены", 2: "смен", 4: "смен", 5: "смен", 11: "смен", 12: "смен", 20: "смен", 21: "смены", 22: "смен", 31: "смены", 101: "смены", 111: "смен", 121: "смены" };
    for (const [n, w] of Object.entries(want)) expect([n, pluralGen(Number(n), "смены", "смен")]).toEqual([n, w]);
  });
  it("число со словом; отрицательное, дробное и не число — без падения", () => {
    expect(counted(3, ...W)).toBe("3 шага");
    expect(counted(21, "день", "дня", "дней")).toBe("21 день");
    expect(counted(31, "день", "дня", "дней")).toBe("31 день");
    expect(counted(22, "смена", "смены", "смен")).toBe("22 смены");
    expect(plural(-1, ...W)).toBe("шаг");
    expect(plural(-3, ...W)).toBe("шага");
    expect(plural(2.9, ...W)).toBe("шага");
    expect(plural("21", ...W)).toBe("шаг");
    for (const bad of [undefined, null, NaN, "много"]) { expect(plural(bad, ...W)).toBe("шагов"); expect(pluralGen(bad, "смены", "смен")).toBe("смен"); }
  });
  it("экраны: в шапке графика «31 день», в итогах «22 смены», у коктейля «3 шага», в рейтинге «очко, очка, очков»", () => {
    const sch = rd("ui/schedule.jsx");
    expect(sch).toContain('import { plural, pluralGen } from "../lib/ru-num";');
    for (const part of ['{DAYS} {plural(DAYS, "день", "дня", "дней")}</div>', 'итог месяца: {shifts} {plural(shifts, "смена", "смены", "смен")} ·', '{b.shifts} {plural(b.shifts, "смена", "смены", "смен")}</span>',
      '{r.cap} из {r.need} {pluralGen(r.need, "смены", "смен")}</span>', 'не хватит примерно {r.need - r.cap} {pluralGen(r.need - r.cap, "смены", "смен")} за месяц,',
      '${mx} ${plural(mx, "смена", "смены", "смен")} подряд при пределе', 'note: `${n} ${plural(n, "смена", "смены", "смен")} × ${x.rate}`',
      '${plural(n, "Перенесена", "Перенесено", "Перенесено")} ${n} ${plural(n, "смена", "смены", "смен")} из прошлого месяца',
      'потребность ${needTotal} ${plural(needTotal, "смена", "смены", "смен")} в месяц', '${staff.length} ${plural(staff.length, "сотрудник", "сотрудника", "сотрудников")}`',
      'hint={shifts + " " + plural(shifts, "смена", "смены", "смен") + " · "']) expect([part, sch.includes(part)]).toEqual([part, true]);
    expect(rd("lib/schedule-gen.js")).toContain('вышло бы ${run} ${plural(run, "смена", "смены", "смен")} подряд, а можно ${R.maxRow}');
    expect(rd("ui/cocktails.jsx")).toContain('Сборка · {seq.length} {plural(seq.length, "шаг", "шага", "шагов")} · как в тренажёре');
    expect(count(rd("ui/cocktail-editor.jsx"), '"шаг", "шага", "шагов")')).toBe(2);
    expect(count(rd("ui/content-editor.jsx"), '"шаг", "шага", "шагов")')).toBe(3);
    expect(rd("ui/bar-card-print.jsx")).toContain('{list.length} {plural(list.length, "позиция", "позиции", "позиций")}');
    expect(rd("ui/menu-print.jsx")).toContain('${list.length} ${plural(list.length, "блюдо", "блюда", "блюд")}');
    expect(rd("ui/league.jsx")).toContain('{plural(ptsOf(r), "очко", "очка", "очков")}');
    expect(rd("ui/screens-learning.jsx")).toContain('{plural3(practiceState.score, "очко", "очка", "очков")}');
    expect(rd("ui/screens-gamification.jsx")).toContain('{kk(top.pts, "очко", "очка", "очков")}');
    expect(rd("ui/screens-gamification.jsx")).toContain('{count} из {total} {pluralGen(total, "урока", "уроков")}');
    expect(rd("ui/home-hubs.jsx")).toContain('{done} из {total} {pluralGen(total, "урока", "уроков")}');
    expect(rd("ui/bar-lab.jsx")).toContain('{stamps} из {cardTotal()} {pluralGen(cardTotal(), "печати", "печатей")}');
    expect(rd("ui/month-recap.jsx")).toContain('"Календарь: в деле " + r.active + " " + plural(r.active, "день", "дня", "дней")');
  });
  it("в экранах не осталось «{число} слово» в одной форме на все числа", () => {
    // слова, у которых форма зависит от числа; допуск — где число постоянное и форма верна (+10 и +20 очков)
    const re = /\}\s(тестов|уроков|шагов|смен|дней|очков|блюд|позиций|печатей|сотрудников)(?![а-яё])/;
    const allow = [/\?20:10\} очков/];
    const bad = [];
    for (const f of readdirSync("ui").filter((x) => x.endsWith(".jsx"))) {
      rd("ui/" + f).split("\n").forEach((line, i) => { if (re.test(line) && !/^\s*(\/\/|\*|\{\/\*)/.test(line) && !allow.some((a) => a.test(line))) bad.push(f + ":" + (i + 1) + " " + line.trim().slice(0, 90)); });
    }
    expect(bad).toEqual([]);
  });
});

// ── 4. фото проявляется ──────────────────────────────────────────────────────────────────────────────
describe("v165 · 4: лица, фото «О нас» и фото в чате проявляются (ui/lesson-photo.jsx, useSoftImg)", () => {
  const Probe = ({ src, style }) => { const soft = useSoftImg(src); return h("img", { src: src || undefined, alt: "", "data-st": soft.st, ...soft.props(style) }); };
  it("фото известно при первом рисовании — ни класса, ни своей непрозрачности: разметка прежняя", () => {
    const a = noPreload(R(h(Probe, { src: "data:image/jpeg;base64,QUJD", style: { width: "100%", objectFit: "cover" } })));
    expect(a).toBe('<img src="data:image/jpeg;base64,QUJD" alt="" data-st="set" style="width:100%;object-fit:cover"/>');
    const b = noPreload(R(h(Probe, { src: "data:image/jpeg;base64,QUJD" })));
    expect(b).toBe('<img src="data:image/jpeg;base64,QUJD" alt="" data-st="set"/>');
    expect(noPreload(R(h(Probe, { src: null })))).toBe('<img alt="" data-st="set"/>');
  });
  it("проявление — тем же классом и за то же время, что у обложек разделов", () => {
    const lp = rd("ui/lesson-photo.jsx");
    const at = lp.indexOf("export function useSoftImg(src)");
    expect(at).toBeGreaterThan(0);
    const body = lp.slice(at, lp.indexOf("\n}\n", at));
    expect(body).toContain('className: st === "in" ? "sa-photo-in" : undefined');
    expect(body).toContain('style: st === "wait" ? { ...(style || {}), opacity: 0 } : style');
    expect(body).toContain("PHOTO_FADE + 60");
    expect(body).toContain("el.decode().then(go, go)");
    // смена одного фото другим — без проявления; оборванное проявление начнётся заново
    expect(body).toContain('if (!s || was || !el) { setSt("set"); return undefined; }');
    expect(body).toContain("if (!fin) seen.current = was;");
    expect(PHOTO_FADE).toBe(450);
    expect(rd("ui/css.js")).toContain(".sa-photo-in { animation: saPhotoIn .45s ease-out backwards; }");
  });
  it("лицо в кружке: все три вида фото берут проявление; место под фото — буквы, как было", () => {
    const sp = rd("ui/staff-photo.jsx");
    expect(sp).toContain('import { CamIcon, useSoftImg } from "./lesson-photo";');
    expect(sp).toContain("const soft = useSoftImg(e ? src : null);\n  if (!e || !src) return null;");
    expect(count(sp, "{...soft.props(st)} />")).toBe(2);
    expect(sp).toContain('{...soft.props({ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block", pointerEvents: "none", ...style })} />');
  });
  it("фото «О нас»: пока едет — тихая подложка вместо слова «Фото…»; приехало раньше — стоит сразу", () => {
    const wait = noPreload(R(h(ConceptPhoto, { id: "ph-ждём", cap: "Форма зала", onOpen: noop })));
    expect(wait).toContain('<span class="sa-photo-wait" aria-hidden="true" data-photo-wait="" style="position:absolute;inset:0"></span>');
    expect(wait).not.toContain("Фото…");
    expect(wait).not.toContain("<img");
    expect(wait).toMatch(/<button type="button" class="sa-hit" aria-label="Фото: Форма зала" style="[^"]*height:150px;cursor:pointer;display:block;width:100%;position:relative">/);
    conceptPhotoRemember("ph-есть", "data:image/jpeg;base64,REVG", null);
    const have = noPreload(R(h(ConceptPhoto, { id: "ph-есть", cap: "Форма зала", onOpen: noop })));
    expect(have).toContain('<img src="data:image/jpeg;base64,REVG" alt="Форма зала" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block"/>');
    expect(have).not.toContain("data-photo-wait");
    const cp = rd("ui/concept-photo.jsx");
    expect(cp).toContain('import { useSoftImg, PhotoWait } from "./lesson-photo";');
    expect(cp).toContain("Фото не загрузилось");
  });
  it("фото в чате: известное стоит сразу, приехавшее позже проявляется; заглушка на время загрузки прежняя", () => {
    const ch = rd("ui/chat.jsx");
    expect(ch).toContain('import { useSoftImg } from "./lesson-photo";');
    expect(ch).toContain('const soft = useSoftImg(src);\n  return src ? <img src={src} alt={alt} draggable={false} decoding="async" {...soft.props()} /> : <span className="ch-ph-wait" aria-hidden="true" />;');
  });
});
