// Дымовой рендер ключевых экранов (Доп. 218): ловит ошибки первого рендера,
// которые не видит сборщик — «undefined is not an object», «Cannot access before initialization» и т.п.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
// Раз window и document есть, dev-сборка React 18 считает, что она в браузере, и читает
// navigator.userAgent (подсказка про React DevTools). В Node 20 глобального navigator нет —
// без заглушки тест падал с «navigator is not defined». В Node 21+ он есть, его не трогаем.
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, para: { color: "#eee" }, bold: { color: "#fff" }, doneBtn: {}, secTitle: {}, modCard: {}, modBar: {}, modArrow: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, bullet: {}, a11y: false };
const profile = { id: "u1", name: "Тест", surname: "Тестов", restaurant: "Два моря, Океан", position: "manager", is_admin: true };

describe("smoke render", () => {
  it("Колода бармена", async () => { const { CocktailsScreen } = await import("../ui/cocktails"); expect(renderToString(<CocktailsScreen T={T} profile={profile} onBack={() => {}} onBuild={() => {}} onOpenDish={() => {}} />).length).toBeGreaterThan(1000); });
  it("Сборка руками", async () => { const { BarLabScreen } = await import("../ui/bar-lab"); expect(renderToString(<BarLabScreen T={T} profile={profile} onBack={() => {}} onOpenDeck={() => {}} />).length).toBeGreaterThan(1000); });
  it("Сборка руками — со своей картой бара и печатями (Доп. 222)", async () => {
    store.sa_menu_shared = JSON.stringify({ [profile.restaurant]: [{ id: "__barcard__", cocktails: ["negroni", "daiquiri", "mojito"] }] });
    store["sa_bar_mastery_" + profile.name + "_" + profile.surname] = JSON.stringify({ negroni: { level: 2, streak: 1 } });
    const { BarLabScreen } = await import("../ui/bar-lab");
    expect(renderToString(<BarLabScreen T={T} profile={profile} onBack={() => {}} onOpenDeck={() => {}} />).length).toBeGreaterThan(1000);
    expect(renderToString(<BarLabScreen T={T} profile={profile} startId="daiquiri" onBack={() => {}} onOpenDeck={() => {}} />).length).toBeGreaterThan(500);
    delete store.sa_menu_shared;
  });
  it("Редактор коктейлей (Доп. 240)", async () => { const { CocktailEditor } = await import("../ui/cocktail-editor"); expect(renderToString(<CocktailEditor T={T} profile={profile} onBack={() => {}} onOpenCard={() => {}} />).length).toBeGreaterThan(500); });
  it("Карта бара для печати (Доп. 244)", async () => { const { BarCardPrint } = await import("../ui/bar-card-print"); expect(renderToString(<BarCardPrint T={T} profile={profile} onBack={() => {}} />).length).toBeGreaterThan(1000); });
  it("Тренажёр меню", async () => { const { MenuTrainerScreen } = await import("../ui/menu-trainer"); expect(renderToString(<MenuTrainerScreen T={T} profile={profile} role="waiter" onBack={() => {}} />).length).toBeGreaterThan(500); });
  it("Рейтинг", async () => { const { LeaderboardScreen } = await import("../ui/screens-gamification"); expect(renderToString(<LeaderboardScreen T={T} leaderboard={[]} scores={[]} profile={profile} onBack={() => {}} />).length).toBeGreaterThan(500); });
  it("Книга отзывов", async () => { const { GuestBookScreen } = await import("../ui/guestbook"); expect(renderToString(<GuestBookScreen T={T} profile={profile} role="bar" onBack={() => {}} />).length).toBeGreaterThan(500); });
  it("Справочник", async () => { const { ReferenceSection } = await import("../ui/ReferenceSection"); expect(renderToString(<ReferenceSection T={T} profile={profile} onExit={() => {}} onCocktails={() => {}} onBarLab={() => {}} />).length).toBeGreaterThan(500); });

  // ── Доп. 289–293: формат «у стола», меню раздела ──
  const SITS = [
    { genre: "action", emoji: "😰", scene: "Гость спрашивает про блюдо, которого ты не пробовал.", question: "Как поступаешь?", options: ["Угадываю", "«Уточню у шефа — одну секунду»", "Молчу"], correct: 1, win: "🎯 Честно и профессионально!", fail: "😬 Гость потерял доверие." },
    { genre: "truefalse", emoji: "🃏", statement: "Приборы можно выносить голыми руками.", isTrue: false, correct: 1, question: "Это верно?", options: ["✅ Верно", "❌ Неверно"], win: "🎯 Так нельзя!", fail: "😬 Только в салфетке." },
    { genre: "complete", emoji: "🔗", start: "Если сомневаешься, подходить ли к гостю —", question: "Выбери продолжение", options: ["подойди", "жди", "уйди"], correct: 0, win: "🎯 Да", fail: "Нет" },
    { genre: "empathy", emoji: "🎭", guestThought: "Почему так долго?", scene: "Гость ждёт меню 10 минут.", question: "Что он чувствует?", options: ["Доволен", "Раздражён"], correct: 1, win: "🎯 Первые 10 секунд — стандарт.", fail: "💡 Гость думает: «Здесь не рады»." },
    { genre: "timer", emoji: "⚡", scene: "Гость поднял руку.", question: "Что делаешь?", options: ["Подхожу сразу", "Доделываю своё"], correct: 0, win: "🎯 Да", fail: "Нет" },
  ];
  const MOD = { id: "m1", tag: "Урок 1", title: "Мышление сервиса", subtitle: "Фундамент и ошибки", icon: "🧭", color: "#7C9E87", lessons: [
    { id: "l1", type: "lesson", title: "Работа с ошибками", content: "Ошибся — признай, извинись, исправь. Гость, у которого ошибку быстро исправили, лояльнее.\n\n**Шаги**\n• Признать\n• Извиниться\n• Исправить" },
    { id: "l2", type: "lesson", title: "Новичок и меню", content: "Не знаешь блюдо — уточни у шефа. Никогда не угадывай." },
    { id: "p1", type: "practice", title: "Практика ситуаций", situations: SITS },
    { id: "q1", type: "quiz", title: "Тест раздела", questions: [{ q: "?", options: ["а", "б"], correct: 0 }] },
  ] };
  const PS = { step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: SITS, usedIds: [] };
  const noop = () => {};
  // renderToString разделяет соседние текстовые узлы комментариями <!-- --> — для проверок убираем
  const R = (el) => renderToString(el).replace(/<!-- -->/g, "");
  it("Меню раздела (Доп. 292)", async () => {
    const { ModuleScreen } = await import("../ui/screens-learning");
    const html = R(<ModuleScreen mod={MOD} completed={{ l1: true }} quizDone={{}} onBack={noop} onLesson={noop} T={T} next={null} finish={{ title: "Экзамен" }} a11y={false} />);
    expect(html).toContain("Мышление сервиса");
    expect(html).toContain("пройден");
    expect(html).toContain("Дальше");
    expect(html).toContain("Новичок и меню");
    const html2 = R(<ModuleScreen mod={MOD} completed={{ l1: true, l2: true, p1: true }} quizDone={{ q1: true }} onBack={noop} onLesson={noop} T={T} next={null} finish={{ title: "Экзамен" }} a11y />);
    expect(html2).toContain("сдан");
    expect(html2).toContain("Раздел пройден целиком");   // v73: строка курсивом, с заглавной
  });
  it("Практика «у стола» — вопрос, ответ, итог (Доп. 290)", async () => {
    const { TablePractice } = await import("../ui/table");
    const L = MOD.lessons[2];
    const P = (ps) => R(<TablePractice inline lesson={L} color={MOD.color} practiceState={ps} setPracticeState={noop} onPracticeChoice={noop} onPracticeNext={noop} onBack={noop} onComplete={noop} onClassic={noop} onMistakes={noop} streak={{ count: 2, best: 3, last: "2026-10-10", days: [] }} profile={profile} />);
    for (let i = 0; i < SITS.length; i++) {
      expect(P({ ...PS, step: i })).toContain("Ситуация " + (i + 1) + " из " + SITS.length);
      const wrong = (SITS[i].correct + 1) % SITS[i].options.length;
      const h = P({ ...PS, step: i, isAnswered: true, choice: wrong, lives: 2 });
      expect(h).toMatch(/Лучше так|Ответ/);
      expect(P({ ...PS, step: i, isAnswered: true, choice: SITS[i].correct, combo: 2, score: 30 })).toContain("комбо");
    }
    expect(P({ ...PS, step: 4, isAnswered: true, choice: -1, lives: 2 })).toContain("время вышло");
    const fin = P({ ...PS, done: true, results: [true, false, true], score: 40, lives: 2 });
    expect(fin).toContain("Практика пройдена");
    expect(fin).toContain("Разбор раунда");
    expect(fin).toContain("Сыграть ещё раз");
    expect(P({ ...PS, done: true, results: [false, false, false], score: 0, lives: 0 })).toContain("Раунд окончен");
  });
  it("«Закрепить у стола» после урока + повтор ошибки (Доп. 289, 293)", async () => {
    const { TableCheck, checkSituations, dueMistake, mistakeFromSituation } = await import("../ui/table");
    const L = MOD.lessons[0];
    expect(checkSituations(L, MOD).length).toBe(2);
    const bank = [{ q: "Что делать, если ошибся?", options: ["Признать и исправить", "Промолчать"], correct: 0, explanation: "Признай.", lessonId: "l1", lessonTitle: "Работа с ошибками", stage: 1, due: 0 }];
    expect(dueMistake(bank, MOD)).toBe(bank[0]);
    expect(dueMistake([{ ...bank[0], due: Date.now() + 1e7 }], MOD)).toBe(null);
    const html = R(<TableCheck inline lesson={L} mod={MOD} color={MOD.color} profile={profile} streak={{ count: 1, last: "", days: [] }} next={null} mistakeBank={bank} onComplete={noop} onNext={noop} onClose={noop} onMistakes={noop} onResolveMistake={noop} onFailMistake={noop} />);
    expect(html).toContain("Ситуация 1 из 2");
    expect(html).toContain("У стола");
    const tf = mistakeFromSituation(SITS[1], L);
    expect(tf.fixed).toBe(true);
    expect(tf.options).toEqual(["Правда", "Миф"]);
    expect(tf.options[tf.correct]).toBe("Миф");
    const ac = mistakeFromSituation(SITS[3], L);
    expect(ac.q).toContain("Мысли гостя");
    expect(ac.options[ac.correct]).toBe("Раздражён");
  });
  it("Урок с кнопкой «Закрепить у стола» и место в уроке (Доп. 289, 293)", async () => {
    const { LessonScreen, loadTable } = await import("../ui/screens-learning");
    await loadTable();
    const L = { id: "l9", type: "lesson", title: "Длинный урок", content: Array.from({ length: 8 }, (_, i) => "**Часть " + (i + 1) + "**\n" + "Текст урока про сервис и гостей. ".repeat(14)).join("\n\n") };
    store["sa_card_pos_" + profile.name + "_" + profile.surname] = JSON.stringify({ l9: 2 });
    const T2 = { ...T, lessBody: {}, lessGlass: {}, quote: {}, check: {}, forbidden: {}, good: {}, bad: {}, note: {}, principle: {} };
    const html = R(<LessonScreen lesson={L} color="#7C9E87" onBack={noop} onComplete={noop} quizState={{ step: 0, answers: [] }} onQuiz={noop} practiceState={PS} setPracticeState={noop} onPracticeChoice={noop} onPracticeNext={noop} T={T2} mod={{ ...MOD, lessons: [L, MOD.lessons[2]] }} profile={profile} streak={null} mistakeBank={[]} />);
    expect(html).toContain("Продолжаем с того же места");
    expect(html).toContain("карточка 3 из");
    delete store["sa_card_pos_" + profile.name + "_" + profile.surname];
  });

  // ── v28 (Доп. 294–306) ──
  it("Главная: значки ритма дня, строка разминки, чек недели (Доп. 298, 301, 305, 306)", async () => {
    const { DayChips, DayStrip, WarmupCard, WeekCard } = await import("../ui/day-cards");
    const st = { count: 5, last: "2026-10-12", days: [] };
    const chips = R(<DayChips a11y={false} streak={st} steps={1} goal={2} onGoal={noop} today="2026-10-12" />);
    expect(chips).toContain("Цель дня: 1 из 2");
    expect(chips).toContain("Серия 5 дней, сегодня свеча горит");
    expect(R(<DayStrip a11y streak={st} steps={2} goal={2} onGoal={noop} today="2026-10-12" />)).toContain("цель дня есть");
    const line = R(<WarmupCard compact a11y={false} shift="Вечер · 16:00–24:00" known done={false} onStart={noop} />);
    expect(line).toContain("Сегодня вечер, 16:00–24:00");
    expect(line).toContain("разминка 2 мин");
    expect(R(<WarmupCard compact a11y={false} shift="" known done onStart={noop} />)).toBe("");
    expect(R(<WarmupCard a11y={false} shift="" known={false} done={false} onStart={noop} />)).toContain("Перед сменой");
    expect(R(<WeekCard a11y={false} activeDays={3} onOpen={noop} />)).toContain("в деле 3 дня из 7");
  });
  it("Разминка до смены и чек недели «у стола» (Доп. 301, 305)", async () => {
    const { TableCheck, WeekReceipt } = await import("../ui/table");
    const warm = R(<TableCheck inline mode="warmup" situations={SITS.slice(0, 3)} modules={[MOD]} shift="Вечер · 16:00–24:00" color={MOD.color} profile={profile} streak={{ count: 1, last: "", days: [] }} mistakeBank={[]} mentorName="Мария" goal={{ steps: 0, goal: 2 }} onFinish={noop} onClose={noop} onMistakes={noop} />);
    expect(warm).toContain("Разминка до смены");
    expect(warm).toContain("смена · Вечер · 16:00–24:00");
    expect(warm).toContain("Подсмотреть в уроке");
    const sum = { from: "2026-10-06", to: "2026-10-12", activeDays: 4, totals: { st: 3, l: 1, p: 1, q: 0, d: 0, b: 0, w: 1, s: 4, f: 0 },
      days: ["06", "07", "08", "09", "10", "11", "12"].map((d, i) => ({ key: "2026-10-" + d, dow: (i + 1) % 7, steps: i % 2, active: i % 2 === 0, frozen: i === 3 })) };
    const wk = R(<WeekReceipt inline a11y={false} profile={profile} streak={{ count: 3, last: "2026-10-12" }} summary={sum} goal={2} shareUrl="https://t.me/x" onClose={noop} />);
    expect(wk).toContain("Чек недели");
    expect(wk).toContain("06.10–12.10");
    expect(wk).toContain("Разминки до смены");
    expect(wk).toContain("Отправить команде");
  });
  it("Допуск наставника: подтверждение в зале (Доп. 303)", async () => {
    const { MentorScreen } = await import("../ui/mentor");
    const T3 = { ...T, lessGlass: {} };
    const emp = R(<MentorScreen T={T3} a11y={false} profile={{ ...profile, position: "waiter", is_admin: false }} role="seasonal" roleObj={{ label: "Новичок" }} onBack={noop} />);
    expect(emp).toContain("Допуск наставника");
    expect(emp).toContain("Встреча и приветствие");
    const lead = R(<MentorScreen T={T3} a11y profile={profile} role="seasonal" roleObj={{ label: "Новичок" }} onBack={noop} onInbox={noop} />);
    expect(lead).toContain("Навыки");
  });
  it("Урок: «N из M» — содержание раздела (Доп. 306)", async () => {
    const { LessonScreen } = await import("../ui/screens-learning");
    const T2 = { ...T, lessBody: {}, lessGlass: {}, quote: {}, check: {}, forbidden: {}, good: {}, bad: {}, note: {}, principle: {} };
    const L = MOD.lessons[1];
    const html = R(<LessonScreen lesson={L} color="#7C9E87" onBack={noop} onComplete={noop} quizState={{ step: 0, answers: [] }} onQuiz={noop} practiceState={PS} setPracticeState={noop} onPracticeChoice={noop} onPracticeNext={noop} T={T2} mod={MOD} profile={profile} streak={null} mistakeBank={[]} onContents={noop} />);
    expect(html).toContain("2 из 4");
    expect(html).toContain("Содержание раздела: шаг 2 из 4");
    expect(R(<LessonScreen lesson={L} color="#7C9E87" onBack={noop} onComplete={noop} quizState={{ step: 0, answers: [] }} onQuiz={noop} practiceState={PS} setPracticeState={noop} onPracticeChoice={noop} onPracticeNext={noop} T={T2} mod={MOD} profile={profile} streak={null} mistakeBank={[]} />)).not.toContain("Содержание раздела");
  });
  it("Трек — меню тем с оглавлением и прежний список (Доп. 307)", async () => {
    const { HomeScreen } = await import("../ui/screens-learning");
    const T4 = { ...T, homeRoleBadge: {}, changeRoleBtn: {}, modList: {}, modIcon: {}, modInfo: {}, modTag: {}, modRight: {}, homeHead: {}, homeTopRow: {}, logoRow: {}, logoText: {} };
    const MOD2 = { ...MOD, id: "m2", tag: "Урок 2", title: "Второй раздел", lessons: [{ id: "x1", type: "lesson", title: "Урок икс", content: "Текст." }] };
    const roleObj = { id: "seasonal", label: "Новичок", sublabel: "Сезонный сотрудник", color: "#7C9E87" };
    const H = (extra) => R(<HomeScreen role={roleObj} modules={[MOD, MOD2]} customModules={[]} completed={{ l1: true }} quizDone={{}} progress={10} doneCount={1} totalLessons={5}
      onModule={noop} onChangeRole={noop} T={T4} streak={{ count: 3, last: "", days: [] }} a11y={false} profile={profile} mistakeBank={[{ q: "?", options: ["a", "b"], correct: 0, due: 0 }]} onMistakes={noop}
      onSearch={noop} dayGoal={{ steps: 1, goal: 2 }} onLesson={noop} nextFor={() => null} onNext={noop} finish={{ title: "Экзамен ступени", cta: "Сдать ›" }} {...extra} />);
    const html = H({});
    expect(html).toContain("Темы трека");
    expect(html).toContain("Мышление сервиса");
    // Доп. 308: закладка соседней темы на краю, свечение цвета темы (подпись «листай свайпом» ушла)
    expect(html).toContain("Следующая тема: 2 · Второй раздел");
    expect(html).toContain("tbp-tint");
    expect(html).not.toContain("листай темы свайпом");
    expect(html).toContain("Работа над ошибками · 1 вопрос на повтор");
    expect(html).toContain("1/2");
    expect(html).not.toContain("SERVICE ACADEMY");
    expect(H({ focusId: "m2" })).toContain("Второй раздел");
    // в конце меню — «Дальше: 2 · Второй раздел», когда тема не пройдена
    const withNext = H({ nextFor: (m) => ({ mod: m, lesson: m.lessons[m.lessons.length - 1] }) });
    expect(withNext).toContain("tbp-nextlink");
    expect(withNext).toContain("2 · Второй раздел");
    store.sa_track_view = "list";
    const list = H({});
    expect(list).toContain("Программа обучения");
    expect(list).toContain("листать ›");
    expect(H({ pagerOnly: true })).toContain("Темы трека");
    delete store.sa_track_view;
  });

  // ── v30 (Доп. 311–320) ──
  it("v30: живой гость, квест, свеча на двоих, лига, радио, итоги, зачёт и золото", async () => {
    const R = (el) => renderToString(el).replace(/<!-- -->/g, "");
    const noop = () => {};
    const { SEASONAL_MODULES } = await import("../data/modules-seasonal");
    const S1 = SEASONAL_MODULES.find((m) => m.id === "s1");
    const { LiveGuestScreen } = await import("../ui/live-guest");
    const lg = R(<LiveGuestScreen a11y={false} profile={{ ...profile, position: "waiter" }} role="seasonal" uk="_x" color="#7C9E87" track={[S1]} modules={[S1]} dishes={[{ name: "Борщ" }]} drinks={[]} onClose={noop} inline />);
    expect(lg).toContain("Живой гость");
    expect(lg).toContain("Подойти к столу");
    const { QuestCard, PairSheet } = await import("../ui/together");
    // v31: сделанная часть сворачивается в строку (задания — по раскрытию), несделанная — список
    expect(R(<QuestCard a11y={false} tasks={[{ id: "warm", need: 1, label: "Разминка до смены — 2 минуты", f: "w" }]} todayRec={{ w: 1 }} />)).toContain("Твоя часть сделана · 1 из 1");
    expect(R(<QuestCard a11y={false} tasks={[{ id: "warm", need: 1, label: "Разминка до смены — 2 минуты", f: "w" }]} todayRec={{}} />)).toContain("Твоя часть · 0 из 1");   // v73: подпись курсивом, обычными буквами
    expect(R(<PairSheet a11y={true} profile={profile} onClose={noop} />)).toContain(">Свеча на двоих<");   // v73: курсивом, обычными буквами
    const { LeagueScreen } = await import("../ui/league");
    expect(R(<LeagueScreen T={{ ...T, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {} }} a11y={false} profile={profile} activity={{}} onBack={noop} />)).toContain("Лига недели");
    const { RadioScreen } = await import("../ui/radio");
    const { buildEpisode } = await import("../lib/radio");
    const ep = buildEpisode(S1, S1.lessons[0], "next", "s");
    const rd = R(<RadioScreen a11y={false} uk="_x" color="#7C9E87" episodes={[ep]} onClose={noop} inline />);
    expect(rd).toContain("Радио в дорогу");
    expect(rd).toContain("Дальше по треку");
    const { MonthRecap } = await import("../ui/month-recap");
    expect(R(<MonthRecap a11y={false} profile={profile} data={{ act: {} }} month="2026-10" onClose={noop} inline />)).toContain("Итоги · октябрь");
    const { TableCheck } = await import("../ui/table");
    const { creditPool, goldPool } = await import("../lib/marks");
    const cr = R(<TableCheck mode="credit" mod={S1} situations={creditPool(S1, 1)} color="#7C9E87" a11y={false} profile={profile} mistakeBank={[]} onClose={noop} inline />);
    expect(cr).toContain("Зачёт на опыт");
    expect(cr).not.toContain("Подсмотреть в уроке");
    const gd = R(<TableCheck mode="gold" mod={S1} situations={goldPool(S1, 1)} timer={20} color="#7C9E87" a11y={false} profile={profile} mistakeBank={[]} onClose={noop} inline />);
    expect(gd).toContain("Раунд мастера");
    expect(gd).toContain("tb-timer");
    const { ModuleMenu } = await import("../ui/module-menu");
    const done = {}; S1.lessons.forEach((l) => { if (l.type !== "quiz") done[l.id] = true; });
    const mm = R(<ModuleMenu mod={S1} completed={done} quizDone={{ "s1-q": true }} onLesson={noop} embedded topic={{ f: { level: "faded", k: 0.4, days: 20 }, gold: { d: "x" }, canGold: true }} acts={{ onRefresh: noop, onGold: noop }} />);
    expect(mm).toContain("Тема выдохлась");
    expect(mm).toContain("Золото · ещё раз");
    // ревью v30: в теме без заданий «у стола» нет кнопки «Освежить»
    const mm2 = R(<ModuleMenu mod={S1} completed={done} quizDone={{ "s1-q": true }} onLesson={noop} embedded topic={{ f: null, canRefresh: false, canGold: false }} acts={{ onRefresh: noop, onGold: noop }} />);
    expect(mm2).not.toContain("Освежить · 1 мин");
    expect(mm).toContain("Освежить · 1 мин");
  });

  it("ревью v30: свеча на двоих — выходной по графику и пропавший напарник", async () => {
    const { pairNudgeText } = await import("../ui/together");
    const base = { partner: { name: "Аня" } };
    expect(pairNudgeText({ ...base, partner_today: { state: 2, warm: 1 }, me_today: { state: 0 } })).toBe("Аня уже размялась — твоя очередь");
    expect(pairNudgeText({ ...base, partner_today: { state: 1 }, me_today: { state: 2 } })).toBe("Ты свою часть сделал(а). Аня сегодня не в смене — свеча подождёт");
    expect(pairNudgeText({ ...base, partner_today: { state: 0 }, me_today: { state: 1 } })).toBe("У тебя выходной по графику — свечу сегодня держит Аня");
    expect(pairNudgeText({ ...base, partner_today: { state: 2 }, me_today: { state: 1 } })).toBe("У тебя выходной по графику, а Аня свою часть сделала — свеча горит");
    expect(pairNudgeText({ ...base, partner_today: { state: 1 }, me_today: { state: 1 } })).toBe("Сегодня у обоих выходной — свеча подождёт");
    // напарник не в смене, а я в смене и не занимался — серию держу я (пропуск её погасит)
    expect(pairNudgeText({ ...base, partner_today: { state: 1 }, me_today: { state: 0 } })).toBe("Аня сегодня не в смене — свечу сегодня держишь ты: хотя бы один шаг");
    expect(pairNudgeText({ ...base, partner_today: { state: 0 }, me_today: { state: 2 } })).toBe("Ты свою часть сделал(а). Аня — ещё нет: свеча ждёт двоих");
    expect(pairNudgeText({ partner: null, partner_today: {}, me_today: {} })).toBe("");
  });

  // ── Доп. 309: отчёты по сотрудникам ──
  it("Отчёты: список и своя карточка (Доп. 309)", async () => {
    const { ReportScreen } = await import("../ui/report");
    const team = renderToString(<ReportScreen a11y={false} profile={profile} customLessons={[]} onBack={() => {}} />);
    expect(team).toContain("Отчёты по сотрудникам");
    expect(team).toContain("Загружаю команду");
    const mine = renderToString(<ReportScreen a11y={true} profile={{ ...profile, position: "waiter", is_admin: false }} customLessons={[]} onBack={() => {}} startSelf />);
    expect(mine.length).toBeGreaterThan(200);
  });
  // ── v31 (Доп. 323–330) ──
  it("v31: погреб тем, стол сверху, радио с названиями, итоги без системного шрифта, правила зачёта", async () => {
    const R = (el) => renderToString(el).replace(/<!-- -->/g, "");
    const noop = () => {};
    const { SEASONAL_MODULES } = await import("../data/modules-seasonal");
    const S0 = SEASONAL_MODULES.find((m) => m.id === "s0"), S1 = SEASONAL_MODULES.find((m) => m.id === "s1");
    const done = {}; S1.lessons.forEach((l) => { if (l.type !== "quiz") done[l.id] = true; });
    const { CellarScreen } = await import("../ui/cellar");
    const cl = R(<CellarScreen T={T} a11y={false} modules={[S0, S1]} completed={done} quizDone={{ "s1-q": true }} marks={{ fresh: { s1: { t: Date.now() - 40 * 86400000, n: 0 } }, credit: {}, gold: {} }}
      onBack={noop} onOpenTopic={noop} onRefresh={noop} onGold={noop} onCredit={noop} onFreshAll={noop} onProbe={noop} probeCount={2} />);
    expect(cl).toContain("Погреб тем");
    expect(cl).toContain("Освежить всё выдохшееся");
    expect(cl).toContain("Проверка по треку");
    const { LiveGuestScreen } = await import("../ui/live-guest");
    const lg = R(<LiveGuestScreen a11y={false} profile={{ ...profile, position: "waiter" }} role="seasonal" uk="_x" color="#7C9E87" track={[S1]} modules={[S1]} dishes={[{ name: "Борщ" }]} drinks={[]} onClose={noop} inline />);
    expect(lg).toContain("lg-top");
    expect(lg).toMatch(/aria-label="Стол \d+, за столом: \d"/);
    const { RadioScreen } = await import("../ui/radio");
    const { buildEpisode } = await import("../lib/radio");
    const eps = [buildEpisode(S1, S1.lessons[0], "repeat", "a"), buildEpisode(S0, S0.lessons[0], "repeat", "b")];
    const rd = R(<RadioScreen a11y={false} uk="_x" color="#7C9E87" episodes={eps} onClose={noop} inline />);
    expect(rd).toContain(eps[0].title);
    expect(rd).toContain(eps[1].title);
    const { MonthRecap } = await import("../ui/month-recap");
    R(<MonthRecap a11y={false} profile={profile} data={{ act: { "2026-09-03": { st: 2, l: 2 }, "2026-10-02": { st: 3, l: 3 } } }} month="2026-10" onClose={noop} inline />);
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("ui/month-recap.jsx", "utf8");
    expect(src.slice(src.indexOf("const CSS = `"), src.indexOf("`;", src.indexOf("const CSS = `"))).includes("system-ui")).toBe(false);   // шрифты приложения
    const { TableCheck } = await import("../ui/table");
    const { creditPool } = await import("../lib/marks");
    const cr = R(<TableCheck mode="credit" mod={S1} situations={creditPool(S1, 1)} color="#7C9E87" a11y={false} profile={profile} mistakeBank={[]} onClose={noop} inline
      intro={{ title: "Зачёт на опыт", lines: ["7 заданий без подсказок"], icons: ["✎"], cta: "Начать зачёт" }} />);
    expect(cr).toContain("7 заданий без подсказок");
    expect(cr).toContain("Начать зачёт");
  });
});
