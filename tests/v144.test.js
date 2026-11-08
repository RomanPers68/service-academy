// v144: вычитка добавленного в v140–v143 (Доп. 464) и темы бара «для ознакомления» без юридического слоя (Доп. 465).
// Владелец (08.11): «Ок» — 1) исправить всё по вычитке; 2) у барменов убрать юридическое (штрафы, статьи КоАП и ФЗ, пункты
// СанПиН и ПП), практические правила оставить, урок «Ответственность: штрафы и шесть правил» — только у менеджера; 3) «Урок 7»
// и «Урок 8» бара — для ознакомления: не в прогрессе, отчёте, «Роль пройдена», «Дальше», заданиях дня, тест — самопроверка,
// план новичка — как раньше; 4) темы менеджера остаются обычными.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MANAGER_MODULES } from "../data/modules-manager";
import { CORE_MODULES } from "../data/modules-core";
import { BAR_MODULES } from "../data/modules-bar";
import { SPG_MODULES } from "../data/modules-spg";
import { MODULES_INDEX } from "../data/modules-index";
import { MODULES, programOf, programAll } from "../data/modules";
import { BUILDS } from "../data/builds";
import { DIALOGUES_DATA } from "../data/dialogues";
import { GLOSSARY } from "../data/glossary";
import { MODULE_REVIEWS } from "../data/reviews";
import { NB_COMP_MODULES } from "../lib/newbie";
import { isInfo, countable, infoLessonIds, moduleOfLesson, INFO_LABEL, INFO_NOTE } from "../lib/info-topics";
import { canCredit, canGold, canRefresh } from "../lib/marks";
import { stepIndex, trackTotals, personModel } from "../lib/report-model";
import { quizTopic, rulePhrase } from "../ui/quiz-bits";
import { answerTell } from "../lib/answer-tell";

const rd = (p) => readFileSync(p, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const EMOJI = /\p{Extended_Pictographic}/u;   // как в tests/v142, v143
const mod = (mods, id) => mods.find((m) => m.id === id);
const B7 = mod(BAR_MODULES, "bar7"), B8 = mod(BAR_MODULES, "bar8"), M8 = mod(MANAGER_MODULES, "m8"), M9 = mod(MANAGER_MODULES, "m9");
const les = (m, t = "lesson") => m.lessons.filter((l) => l.type === t);
const all = (m) => m.lessons.map((l) => [l.title, l.content || "", ...(l.questions || []).map((q) => q.q + " " + q.options.join(" ") + " " + q.explanation),
  ...(l.situations || []).map((s) => JSON.stringify(s))].join("\n")).join("\n");
const LEGAL = /КоАП|ФЗ|СанПиН|ПП РФ|штраф|ст\. \d|п\. \d|млн ₽|000 ₽|№ 1515|4282/i;
const ALLDATA = ["data/modules-bar.js", "data/modules-core.js", "data/modules-manager.js", "data/modules-spg.js", "data/dialogues.js", "data/builds.js", "data/glossary.js", "data/reviews.js"].map(rd).join("\n");

describe("v144 (Доп. 465): у бара «Урок 7» и «Урок 8» — для ознакомления и без юридического слоя", () => {
  it("bar7 и bar8 помечены info, остальные темы всех треков — нет; у менеджера m8 и m9 — обычные", () => {
    expect([B7.info, B8.info]).toEqual([true, true]);
    const infos = [...BAR_MODULES, ...MANAGER_MODULES, ...CORE_MODULES, ...SPG_MODULES].filter(isInfo).map((m) => m.id);
    expect(infos).toEqual(["bar7", "bar8"]);
    expect([M8.info, M9.info]).toEqual([undefined, undefined]);
    // индекс уроков (отчёт руководителя) знает пометку
    expect(MODULES_INDEX.bar.filter((m) => m.info).map((m) => m.id)).toEqual(["bar7", "bar8"]);
    expect(MODULES_INDEX.manager.some((m) => m.info)).toBe(false);
  });
  it("у бара нет штрафов, статей КоАП и ФЗ, пунктов СанПиН и ПП — ни в уроках, ни в тесте, ни в практике", () => {
    for (const m of [B7, B8]) for (const l of m.lessons) {
      const t = all({ lessons: [l] });
      expect(LEGAL.test(t), l.id + ": " + (t.match(LEGAL) || [])[0]).toBe(false);
    }
  });
  it("у менеджера юридическое на месте: штрафы, статьи, пункты СанПиН и ПП", () => {
    const t8 = all(M8), t9 = all(M9);
    for (const s of ["штраф организации от 1 до 1,5 млн ₽", "КоАП РФ, ст. 15.12, ч. 4", "(171-ФЗ, ст. 18)", "у организации — 20 000 ₽ за каждую единицу",
      "СанПиН для общепита 2.3/2.4.4282-26"]) expect(t8, s).toContain(s);
    for (const s of ["(ПП РФ № 1515, п. 18)", "(СанПиН 2.3/2.4.4282-26, п. 13)", "(СанПиН 2.3/2.4.4282-26, п. 29)", "(СанПиН 2.3/2.4.4282-26, п. 37)", "(СанПиН, п. 35)",
      "СанПиН (п. 38) требует", "(СанПиН, п. 46)", "(п. 47)", "п. 40, 48"]) expect(t9, s).toContain(s);
    expect(les(M8).map((l) => l.title)).toContain("Ответственность: штрафы и шесть правил");
  });
  it("урок «Ответственность: штрафы…» — только у менеджера; у бара — «Шесть правил и три проверки» без штрафов", () => {
    const b6 = les(B7)[5];
    expect(b6.title).toBe("Шесть правил и три проверки");
    expect(les(B7).map((l) => l.title)).not.toContain("Ответственность: штрафы и шесть правил");
    for (const s of ["1️⃣ Не принимаем бутылку без марки или с повреждённой маркой", "6️⃣ Не оставляем вскрытую бутылку без стикера с датой",
      "В конце смены ответственный за ЕГАИС проверяет", "Раз в месяц управляющий проводит инвентаризацию бара", "«Чек-листы» → «Открытие»: пункт «Вскрытые бутылки: стикеры и сроки»"])
      expect(b6.content, s).toContain(s);
    expect(b6.content.length).toBeGreaterThan(900);
    expect(b6.content).not.toContain("«Утро руководителя»");   // экран руководителя бармену не виден
  });
  it("практические правила у бара остались: сроки, порядок, условия хранения", () => {
    const t7 = all(B7), t8 = all(B8);
    for (const s of ["По закону — не позднее следующего рабочего дня после приёмки. Стандарт холдинга — в день поставки.", "Бутылку без марки ЕГАИС не знает",
      "касса проверяет код в «Честном знаке» и получает запрет на просроченное", "Запрет не обходим: товар убираем из продажи и говорим администратору",
      "храним только в месте, указанном в лицензии, и в сезонном зале. ", "Температуру в холодильниках и камерах записываем в журнал каждый день.",
      "Тихое вино — 3 суток с вакуумной пробкой"]) expect(t7, s).toContain(s);
    for (const s of ["Мерный стакан всегда на баре: гость вправе проверить объём своей порции", "В каждом холодильнике — термометр, не ртутный",
      "Лёд делаем только из питьевой воды. Посуду и оборудование тоже моем питьевой водой", "Посуду гостей моем отдельно от кухонной",
      "Аппараты для напитков обрабатываем моющими и дезинфицирующими средствами по инструкции изготовителя", "к вентилю не идём"]) expect(t8, s).toContain(s);
  });
  it("общие уроки бара и менеджера совпадают там, где юридического не было: 1 и 3 у «Приёма», 5 и 6 у «Инвентаря»", () => {
    for (const i of [0, 2]) expect(les(B7)[i].content).toBe(les(M8)[i].content);
    for (const i of [1, 3, 4, 5]) expect(les(B7)[i].content).not.toBe(les(M8)[i].content);
    for (const i of [4, 5]) expect(les(B8)[i].content).toBe(les(M9)[i].content);
    for (const i of [0, 1, 2, 3]) expect(les(B8)[i].content).not.toBe(les(M9)[i].content);
    expect(rd("data/modules-bar.js")).toContain("(info: в прогресс трека и отчёт не входит) и без юридического слоя");
  });
  it("тест у бара — «Самопроверка», 20 вопросов без штрафов; у менеджера — «Тест»", () => {
    expect(les(B7, "quiz")[0].title).toBe("Самопроверка: приём и хранение");
    expect(les(B8, "quiz")[0].title).toBe("Самопроверка: инвентарь и оборудование");
    expect(les(M8, "quiz")[0].title).toBe("Тест: приём и хранение");
    expect(les(M9, "quiz")[0].title).toBe("Тест: инвентарь и оборудование");
    for (const m of [B7, B8]) expect(les(m, "quiz")[0].questions.length).toBe(20);
    expect(les(B7, "quiz")[0].questions.map((q) => q.q)).not.toContain("Какой штраф организации за алкоголь без марки?");
    expect(les(B7, "quiz")[0].questions.map((q) => q.q)).toContain("Кто в конце смены проверяет, что все ТТН и УПД за день обработаны?");
    expect(quizTopic("Самопроверка: приём и хранение")).toBe("Приём и хранение");
    expect(quizTopic("Тест: приём и хранение")).toBe("Приём и хранение");
    expect(rulePhrase(12, true)).toBe("Для зачёта нужно 10 верных из 12. Можно ошибиться два раза, на третьей ошибке самопроверка закончится. Пройти заново можно сразу.");
    expect(rulePhrase(12)).toContain("на третьей ошибке тест закончится. Пересдать можно сразу.");
  });
  it("варианты в тестах и практике обеих тем почти одной длины, верный не угадывается (как tests/v38)", () => {
    for (const m of [B7, B8, M8, M9]) for (const l of m.lessons) {
      const items = l.type === "quiz" ? l.questions.map((q) => ({ o: q.options, c: q.correct }))
        : (l.situations || []).filter((s) => s.genre !== "truefalse").map((s) => ({ o: s.options, c: s.correct }));
      for (const x of items) {
        const L = x.o.map((s) => s.length), mx = Math.max(...L), mn = Math.min(...L);
        if (mx <= 24) expect(mx - mn, l.id + " " + L.join("/")).toBeLessThanOrEqual(8);
        else expect(mx / mn, l.id + " " + L.join("/")).toBeLessThanOrEqual(1.3);
        expect(answerTell(x.o, x.c), l.id).toBe(false);
      }
    }
  });
  it("общие диалоги и сборки бара и менеджера — без штрафов и номеров пунктов (юридическое — в уроках менеджера)", () => {
    for (const id of ["bar-b7-1", "bar-b8-1"]) expect(LEGAL.test(JSON.stringify(DIALOGUES_DATA.find((d) => d.id === id))), id).toBe(false);
    for (const id of ["receive-bar", "receive-admin", "glass-ice"]) expect(LEGAL.test(JSON.stringify(BUILDS.find((b) => b.id === id))), id).toBe(false);
    // сборка «Поломка на смене» — только у менеджера: пункты СанПиН остаются
    expect(JSON.stringify(BUILDS.find((b) => b.id === "breakdown-admin"))).toContain("СанПиН (п. 37)");
    // глоссарий общий для всех треков — без номеров пунктов
    for (const t of ["Мерный стакан", "Журнал температур"]) expect(LEGAL.test(GLOSSARY.find((g) => g.term === t).def), t).toBe(false);
  });
});

describe("v144 (Доп. 465): тема для ознакомления не считается и не зовёт", () => {
  const app = rd("App.jsx");
  it("lib/info-topics: пометка, отбор, шаги темы", () => {
    expect([isInfo(B7), isInfo(M8), isInfo(null)]).toEqual([true, false, false]);
    expect(countable(BAR_MODULES).map((m) => m.id)).toEqual(["bar0", "bar1", "bar2", "bar3", "bar4", "bar5", "bar6"]);
    expect(countable(MANAGER_MODULES).length).toBe(MANAGER_MODULES.length);
    const ids = infoLessonIds(BAR_MODULES);
    expect(ids.size).toBe(B7.lessons.length + B8.lessons.length);
    expect(ids.has("bar7-q") && ids.has("bar8-p") && !ids.has("bar6-q")).toBe(true);
    expect(moduleOfLesson(BAR_MODULES, "bar8-d").id).toBe("bar8");
    expect(INFO_LABEL).toBe("для ознакомления");
    expect(INFO_NOTE).toBe("Тема для ознакомления: в прогресс трека и отчёт руководителя не входит");
  });
  it("программа роли (статистика, рейтинг, сертификаты, карточка обучения) — без тем для ознакомления", () => {
    MODULES.bar = BAR_MODULES;
    expect(programOf("bar").map((m) => m.id)).toEqual(["bar0", "bar1", "bar2", "bar3", "bar4", "bar5", "bar6"]);
    expect(programAll().bar.some(isInfo)).toBe(false);
    expect(rd("data/modules.js")).toContain("export function programOf(role) { return countable([...(MODULES[role] || []), ...(CUSTOM_BY_ROLE[role] || [])]); }");
  });
  it("ни «Освежить», ни «Зачёт на опыт», ни «Раунд мастера» у темы для ознакомления", () => {
    expect([canRefresh(B7), canCredit(B7), canGold(B7), canRefresh(B8), canCredit(B8), canGold(B8)]).toEqual([false, false, false, false, false, false]);
    expect([canRefresh(M8), canCredit(M8), canGold(M8)]).toEqual([true, true, true]);
  });
  it("App: прогресс, «Дальше», задания дня, разминка, «Вопрос дня», «Роль пройдена» — по программе без тем для ознакомления", () => {
    expect(app).toContain("const programModules = useMemo(() => countable(programAllMods), [programAllMods]);");
    expect(app.match(/countable\(\[\.\.\.\(MODULES\[role\] \|\| \[\]\), \.\.\.\(customModules \|\| \[\]\)\]\)/g).length).toBe(2);   // «Роль пройдена» — оба места
    expect(app).toContain("const inPages = (m) => !!m && programAllMods.some((x) => x.id === m.id);");
    expect(app).toContain("const nx = cur >= 0 ? (seq[cur + 1] || null) : quiet ? null : nextLessonOf(programModules, newCompleted, newQuizDone);");
    expect(app).toContain("const behind = cur > 0 && !quiet ?");
    expect(app).toContain("if (m && (m.custom || isInfo(m))) {");
    // по-прежнему по programModules: задания дня, «Вопрос дня», разминка, радио, шаг дня, погреб
    for (const s of ["buildQdayQueue({ mistakeBank: mistakeBankRef.current, programModules,", "warmupPool(programModules, completed, quizDone)",
      "playlist({ modules: programModules,", "next: nextLessonOf(programModules, completed, quizDone)", "CellarScreen T={T} a11y={a11y} modules={programModules}",
      "role={role} modules={programModules} onBack={() => navigate(\"roleSelect\")}"]) expect(app, s).toContain(s);
    // все темы — листание трека, поиск, «Подсмотреть в уроке», урок
    for (const s of ["modules={programAllMods} shift={shiftText}", "situations={special.sits} modules={programAllMods}", "track={programAllMods} modules={[...programAllMods,",
      "modules={programAllMods} mentorName={mentorName}"]) expect(app, s).toContain(s);
  });
  it("App: самопроверка — ответы не в аналитику, ошибки не в «Работу над ошибками», балл не в рейтинг; отметка «пройдено» остаётся", () => {
    expect(app).toContain("const selfCheck = infoIdsRef.current.has(activeLesson.id);");
    expect(app).toContain('if (!selfCheck) try { rpcSync("log_quiz_answer",');
    expect(app).toContain('if (!selfCheck) try { rpcSync("log_quiz_pick",');
    expect(app).toContain('else if (selfCheck) vibrate("error");');
    expect(app).toContain("try { if (profile && !selfCheck) {");
    expect(app).toContain('if (activeLesson.type === "quiz" && profile && selfCheck && !quizDone[activeLesson.id]) {');
    expect(app).toContain('if (activeLesson.type === "quiz" && profile && !selfCheck) {');
    expect(app).toContain("&& !infoIdsRef.current.has(x.lessonId));");
  });
  it("экран трека: «для ознакомления» у номера, в меню темы и в списке; «ты здесь», «К уроку», «Дальше:» и минуты — без неё", () => {
    const sl = rd("ui/screens-learning.jsx"), mm = rd("ui/module-menu.jsx"), css = rd("ui/table-css.js");
    expect(sl).toContain("const curIdx = pages.findIndex((m) => !isInfo(m) && stepsOf(m).some((l) => !isDoneL(l)));");
    expect(sl).toContain("[...countable(modules), ...customModules].reduce((s, m) =>");
    expect(sl).toContain("const nxI = i < 0 ? -1 : isInfo(m) ? (i < pages.length - 1 ? i + 1 : -1) : pages.findIndex((p, k) => k > i && !isInfo(p));");
    expect(sl).toContain('(isInfo(m) ? " info" : "")');
    expect(sl).toContain('const all = [...countable(modules), ...customModules];');
    expect(sl).toContain('{m.tag}{isInfo(m) ? " · " + INFO_LABEL : ""}');
    expect(sl).toContain('{isInfo(mod) ? "Самопроверка" : "Тест"} · {nQ}');
    expect(sl).toContain('{isInfo(mod) ? "Результат самопроверки" : "Результат теста"}');
    expect(sl).toContain('<QuizRuleNote n={nQ} light={light} self={isInfo(mod)} />');
    expect(mm).toContain('{mod.info ? <div className="tbm-infonote" role="note">{INFO_NOTE}</div> : null}');
    expect(mm).toContain('const kind = mod.info && l.type === "quiz" ? "самопроверка" : KIND[l.type] || "урок";');
    expect(css).toContain(".tbm-infonote{");
    expect(css).toContain(".tbp-num.info .n{font-style:italic;opacity:.7}");
  });
  it("выбор роли, сертификаты, экзамен — без тем для ознакомления", () => {
    const rs = rd("ui/screens-roleselect.jsx");
    expect(rs.match(/countable\(\[\.\.\.\(MODULES\[(rid|role)\] \|\| \[\]\), \.\.\.\(customByRole\[(rid|role)\] \|\| \[\]\)\]\)/g).length).toBe(3);
    expect(rd("ui/screens-exam.jsx")).toContain("const mods = MODULES[roleId].filter((m) => m && !m.info);");
  });
  it("отчёт руководителя: тема для ознакомления не в треке и не в итогах, её самопроверка, ответы, ошибки и практика — не в отчёте", () => {
    const idx = stepIndex(MODULES_INDEX);
    expect(idx.tracks.bar.map((m) => m.id)).toEqual(["bar0", "bar1", "bar2", "bar3", "bar4", "bar5", "bar6"]);
    expect(idx.map["bar7-q"]).toMatchObject({ topicId: "bar7", info: true });
    const tot = trackTotals(MODULES_INDEX);
    expect(tot.bar).toBe(countable(BAR_MODULES).reduce((a, m) => a + m.lessons.filter((l) => l.type !== "result").length, 0));
    const barAll = idx.tracks.bar.flatMap((m) => m.steps.map((s) => s.id));
    const raw = { person: { id: "e1", name: "Пётр", position: "bartender" }, last_role: "bar", lessons: [...barAll.filter((x) => !/-q$/.test(x)), "bar7-1", "bar8-1"],
      quiz: [...barAll.filter((x) => /-q$/.test(x)), "bar7-q"], scores: [{ quiz_id: "bar7-q", score: 3, total: 20 }, { quiz_id: "bar6-q", score: 20, total: 20 }],
      events: [{ question: "Кто в конце смены проверяет…", lesson_id: "bar7-q", correct: false, answer: "Никто" }],
      learning: { mistakes: [{ q: "x", l: "bar8-p" }] }, stars: { "bar7-p": 1, "bar6-p": 3 } };
    const pm = personModel(raw, { index: MODULES_INDEX });
    expect(pm.main).toMatchObject({ id: "bar", pct: 100 });
    expect(pm.tests.list.map((t) => t.id)).toEqual(["bar6-q"]);
    expect(pm.tests.passed).toBe(barAll.filter((x) => /-q$/.test(x)).length);
    expect(pm.wrongQuestions).toBe(0);
    expect(pm.repeat.total).toBe(0);
    expect(pm.practice.list.map((p) => p.id)).toEqual(["bar6-p"]);
    expect(rd("scripts/gen-modules-index.mjs")).toContain("...(m.info ? { info: true } : {})");
  });
  it("план новичка у бара — как до v142: «Честность и деньги» нет, гигиена — «Урок 1»", () => {
    expect(NB_COMP_MODULES.bar["Честность и деньги"]).toBeUndefined();
    expect(NB_COMP_MODULES.bar["Гигиена и безопасность"]).toBe("bar1");
    expect(NB_COMP_MODULES.bar["Гигиена и стандарты"]).toBe("bar1");
    expect(Object.values(NB_COMP_MODULES.bar)).not.toContain("bar7");
    expect(Object.values(NB_COMP_MODULES.bar)).not.toContain("bar8");
    expect(NB_COMP_MODULES.manager["Честность и деньги"]).toBe("m7");   // темы менеджера — обычные
  });
  it("«Книга отзывов» у тем для ознакомления остаётся (страница — подарок, не обязанность)", () => {
    for (const k of ["bar7", "bar8"]) expect(MODULE_REVIEWS[k] && MODULE_REVIEWS[k].text.length > 60).toBe(true);
  });
});

describe("v144 (Доп. 464): вычитка v140–v143", () => {
  const FIXED = [
    // v140
    "Личное копится, пока не переведёшь его в разговор о задаче.", "• Нехватка льда, бокалов, рук, времени", "Насыщенное белое, выдержанное в дубе, — 10–12 °C",
    "Лёгкое красное, например Пино нуар, — 12–14 °C", "и никогда не больше 2/3", "И никогда не больше 2/3.", "брожение при более высокой температуре",
    "Пиво, которое бродит при более высокой температуре", "Продажа алкоголя лицам до 18 лет запрещена.", "Когда в бутылке осталось чуть-чуть", "а не по подозрениям при команде",
    "общие и понятные всем", "до того, как гость сядет", "До того, как гость сядет", "Хостес обычно самая новая в команде", "«Вот твои гости.", "Бокал чистый, сполоснут холодной водой",
    "Пена 2–3 см держит аромат", "избавляют от недель напряжения", "Что в очереди бара можно пометить как «горит»?", "Этикет требует красное к мясу",
    "это зона ответственности менеджера", "у руководителя есть «Кто выучил новые вина» и «Кто выучил новинки крепкого»", "наша безопасность; подробнее — в уроке «Безопасность и инциденты»",
    "Молчу и делаю всё как можно быстрее",
    // v141
    "Порядок замещения, часы работы и перерывы у каждого заведения свои.", "например, с кассиром или администратором", "печатаем чек, отдаём и только потом принимаем",
    "смотрит его долю в выручке", "В отчёте терминала нет оплаты стола 12.", "Штрафы за кассу планируют заметно повысить.", "Недостача подтвердилась — проводим проверку: размер ущерба и его причины",
    "включил вторую кассу, принёс чек до оплаты", "итог гоу-листа; сделанное отмечается само", "Кассу открывают до прихода гостей.",
    "За сколько минут до открытия администратор начинает обход?", "За сколько времени до начала доводят график смен до команды?",
    // v142
    "форму акта и то, кому его отдавать, определяет заведение", "Подписал, не пересчитав, — принял", "Отметить, не проверив, — спрятать",
    "Сколько времени по закону даётся на ответ на ТТН в ЕГАИС?", "Жду связи, коробки пусть стоят", "Ждём связи, коробки у входа", "Любой свободный официант",
    "Универсальный транспортный модуль — программа", "Не позднее следующего рабочего дня", "Бутылку забираешь, в ЕГАИС отвечу", "Составляем акт расхождений на бой и подписываем",
    "Сиропы — после вскрытия плотно закрытыми", "Форма по приказу № 164 не применяется; нужен ли журнал, решает юрист холдинга.", "кегу ставим в холодную камеру",
    "Составляем акт расхождений с экспедитором и подписываем вдвоём", "Росалкогольтабакконтроль от отмены отказался, акты подаём, как раньше",
    // v143
    "но порцию отмеряет джиггер", "но отмеряет джиггер", "Порцию отмеряет джиггер.", "моющими и дезинфицирующими средствами по инструкции изготовителя",
    "Живой диалог: «Тут точно 50?»", "От стакана и бокала может отколоться кусочек", "Прозрачного осколка во льду не видно", "Осколок на стенке виден только при ярком свете",
    "Стоит вертикально и закреплён,", "Лайм и лимон для гарнира", "За край: так удобнее", "Ничего: её проверяют только вечером", "Ничего: это дело бармена",
    "Оставляю до утра: утром разберутся", "Это бокал такой: в нём объём", "с другого края ванны: там чисто", "Руками в перчатках: так быстрее всего", "Полотенцем для стекла: оно плотное",
    "свежий лёд бокалом: так быстрее", "из морозилки кухни: он есть", "знакомому электрику: он поможет", "Утром включу: вдруг она заработает", "Ссылаться на форму бокала после замера",
    "а отколовшийся кусочек может попасть в напиток", "**Лёд, гарнир, доска**", "Он без цвета и запаха: утечку не увидеть и не учуять", "Поставщика CO2 выбирает управляющий, он же назначает",
    "Ответственного за ремонт назначает управляющий, он же выбирает сервисные компании.", "поставщик CO2 и сотрудник, который меняет баллоны; ответственный за ремонт и сервисные компании",
    "Даём мерный стакан, мерим при госте", "проверяем при госте.", "Проверка при госте снимает спор.", "Сразу вывожу всех из подвала", "Засыпаю лёд совком, сообщаю администратору",
    "моем в ней посуду дальше", "При замене баллона редуктор снимают", "Сразу выходим и выводим коллегу, к вентилю не идём.",
  ];
  const GONE = ["пока его не перевести", "Нехватка: льда", "выдержанное в дубе — 10", "Пино нуар — 12", "никогда больше 2/3", "более тёплой температуре", "Продажа алкоголя до 18 лет",
    "остался чуть-чуть", "а не подозрениями", "понятны всем", "как гость сел", "самый новый в команде", "Вот, твои гости", "Бокал чистый и сполоснут", "Пена в два-три пальца",
    "сберегают недели напряжения", "Что может считаться «горит»", "Красное к мясу требует этикет", "это зал менеджера", "разобрано в уроке «Безопасность", "быстрее, чем могу",
    "Кто тебя замещает", "например, кассир или администратор", "отдаём, и только потом", "долю от выручки", "оплаты стола 12 нет", "собираются заметно поднять",
    "Ущерб подтвердился — его устанавливают проверкой", "принёс чек до оплаты, включил вторую кассу", "Кассу открывают к открытию зала", "За сколько до открытия", "За сколько до начала",
    "и кому его отдавать определяет", "Подписал не пересчитав", "Отметить не проверив", "Сколько по закону есть на ответ", "Жду связь", "Ждём связь", "Любой официант, кто свободен",
    "Универсальный транспортный модуль: программа", "Её забираешь", "акт расхождений: бой,", "Сиропы — открытые плотно закрытыми", "кегу — в холодную камеру", "подписываем оба",
    "это отозвал", "это подтвердил", "Отмену актов отложили", "порцию меряет джиггер", "но меряет джиггер", "Порцию меряет", "по инструкции изготовителя, моющими",
    "«тут точно 50?»", "Стакан и бокал могут отколоться", "Прозрачный осколок во льду не видно", "Осколок на стенке видно", "и закреплённым", "Лайм и лимон для гарниша", "За край, так",
    "Ничего, её проверяют", "Ничего, это дело бармена", "Оставляю до утра, утром", "Это бокал такой, в нём", "края ванны, там чисто", "в перчатках, так быстрее", "для стекла, оно плотное",
    "свежий лёд бокалом, так быстрее", "кухни, он есть", "электрику, он поможет", "Утром включу, вдруг", "Объяснять форму бокала", "скол может оказаться в напитке", "Лёд, гарнир, нож",
    "Он бесцветный, и по запаху", "кто отвечает за ремонт и какие", "Кто отвечает за ремонт и какие", "мерим при нём", "проверяем при нём", "Проверка при нём", "Сразу выводим всех",
    "Свежий лёд совком и сообщаю", "моем дальше вручную в ней", "его снимают и проверяют прокладку", "вентиль — только если он под рукой"];
  it("исправленный текст на месте", () => { for (const s of FIXED) expect(ALLDATA.includes(s), s).toBe(true); });
  // «гарниш» в прежних уроках бара остаётся (там так везде); в теме «Инвентарь» — «гарнир»
  it("старого текста нет нигде в данных", () => { for (const s of GONE) expect(ALLDATA.includes(s), s).toBe(false); });
  it("«Смена целиком»: касса — сразу после обхода, как в чек-листе «Открытие смены», уроке «Открытие» и «Сборке»", () => {
    const m71 = mod(MANAGER_MODULES, "m7").lessons[0].content;
    const steps = m71.split("**Распорядок смены**\n")[1].split("\n\n")[0].split("\n");
    expect(steps.map((l) => l.replace(/^\S+\s/, "").split(" — ")[0])).toEqual(["За 60 минут до открытия", "Сразу после обхода", "За 30 минут", "За 15 минут", "Открытие",
      "Пиковые часы", "Спокойные часы", "Закрытие"]);
    expect(steps[1]).toBe("2️⃣ Сразу после обхода — кассовая смена под своей учётной записью");
    const m72 = mod(MANAGER_MODULES, "m7").lessons[1].content;
    expect(m72).toContain("📌 Открытие — по часам: обход, касса, брифинг, зал.");
    const b = BUILDS.find((x) => x.id === "opening-admin") || BUILDS.find((x) => (x.stages || []).map((s) => s.n).join(",") === "Обход,Касса,Брифинг,Зал,Гости");
    expect(b.stages.map((s) => s.n)).toEqual(["Обход", "Касса", "Брифинг", "Зал", "Гости"]);
  });
  it("«Не позднее следующего рабочего дня» — верный ответ не выделяется длиной", () => {
    const q = les(M8, "quiz")[0].questions.find((x) => /по закону даётся на ответ на ТТН/.test(x.q));
    expect(q.options[q.correct]).toBe("Не позднее следующего рабочего дня");
    expect(answerTell(q.options, q.correct)).toBe(false);
  });
  it("сорта и суммы — как во всём приложении: «Пино нуар» с прописной, «2 000 ₽»", () => {
    expect(ALLDATA).toContain("Пино нуар");
    expect(rd("data/modules-manager.js")).toContain("2 000 ₽");
  });
});

describe("v144: правила текста и выпуск", () => {
  it("изменённые файлы интерфейса и библиотек: без ритма « — » в строках и без эмодзи", () => {
    for (const f of ["lib/info-topics.js", "ui/module-menu.jsx", "ui/quiz-bits.jsx", "lib/report-model.js", "lib/marks.js", "lib/newbie.js"]) {
      const s = rd(f);
      expect(dashes(s), f).toBe(0);
      expect(EMOJI.test(code(s)), f).toBe(false);
    }
  });
  it("CHANGES и README проверок", () => {
    const ch = rd("CHANGES.md");
    expect(ch).toContain("# Дополнение 464 — вычитка добавленного в v140–v143 (v144)");
    expect(ch).toContain("# Дополнение 465 — «Урок 7» и «Урок 8» бара для ознакомления, у бармена без юридического (v144)");
    expect(rd("tools/claude/README.md")).toContain("e2e-v144.mjs");
  });
});
