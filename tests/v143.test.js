// v143: тема «Инвентарь и оборудование бара» у бара (Урок 8) и у менеджера (Урок 9) по «Стандартам холдинга», модуль 18
// (Доп. 462), и связи с приложением (Доп. 463): пункт «Бар: …» в «Закрытии» по умолчанию, «Утро руководителя» по понедельникам,
// Наставник по стандарту, «Справочник» → «Кофе» → «Чистота машины», «О нас» → «Структура», план новичка.
// Владелец (07.11) на предложение: «Ок».
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MANAGER_MODULES } from "../data/modules-manager";
import { CORE_MODULES } from "../data/modules-core";
import { BAR_MODULES } from "../data/modules-bar";
import { SPG_MODULES } from "../data/modules-spg";
import { SEASONAL_MODULES } from "../data/modules-seasonal";
import { SERVICE_MANAGER_MODULES } from "../data/modules-service_manager";
import { MODULES_INDEX } from "../data/modules-index";
import { BUILDS } from "../data/builds";
import { DIALOGUES_DATA } from "../data/dialogues";
import { GLOSSARY } from "../data/glossary";
import { MODULE_REVIEWS } from "../data/reviews";
import { REFERENCE_COFFEE_COURSE } from "../data/reference";
import { NB_COMP_MODULES } from "../lib/newbie";
import { MOD_SVG, MARKER_RE } from "../ui/icons";
import { iconForEmoji } from "../lib/situation-icons";
import { answerTell } from "../lib/answer-tell";
import { DEFAULT_CHECKLISTS, clLeft, clLeftLine } from "../lib/checklists";
import { eqpChecks, EQP_WEEK, EQP_MONTH, EQP_LESSON } from "../lib/equip-checks";
import { withRefContext, eqpAsked, rcvAsked, EQP_LINE, RCV_LINE } from "../lib/reference-context";
import { CN_KINDS } from "../lib/concept";

const rd = (p) => readFileSync(p, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const B8 = BAR_MODULES.find((m) => m.id === "bar8");
const M9 = MANAGER_MODULES.find((m) => m.id === "m9");
const les = (m, t = "lesson") => m.lessons.filter((l) => l.type === t);
const TXT = les(M9).map((l) => l.content).join("\n");
const TITLES = ["Инвентарь: мерка, совок, полотенца", "Лёд: питьевая вода, совок, бой стекла", "Стекло: осмотр, полировка, хранение",
  "Уход: что мыть и как часто", "Безопасность: электричество и баллоны CO2", "Поломка и сдача бара"];

describe("v143 (Доп. 462): тема в конце треков бара и менеджера, прежнее не тронуто", () => {
  it("бар — девятая тема «Урок 8», менеджер — десятая «Урок 9»; остальные треки как были", () => {
    expect(BAR_MODULES.map((m) => m.id)).toEqual(["bar0", "bar1", "bar2", "bar3", "bar4", "bar5", "bar6", "bar7", "bar8"]);
    expect(MANAGER_MODULES.map((m) => m.id)).toEqual(["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"]);
    expect([CORE_MODULES.length, SPG_MODULES.length, SEASONAL_MODULES.length, SERVICE_MANAGER_MODULES.length]).toEqual([7, 11, 14, 7]);
    for (const [m, tag, sub, first] of [[B8, "Урок 8", "Лёд, стекло, график мойки, CO2 и поломки", BAR_MODULES[0]], [M9, "Урок 9", "Лёд, стекло, график мойки, поломки и контроль", MANAGER_MODULES[0]]]) {
      expect(m).toMatchObject({ tag, title: "Инвентарь и оборудование бара", subtitle: sub, icon: "🧊" });
      expect(typeof MOD_SVG[m.icon]).toBe("function");
      expect(m.color).toBe(first.color);
    }
    // значок темы — кубик льда, которого раньше не было ни у одной темы
    expect([...BAR_MODULES, ...MANAGER_MODULES, ...CORE_MODULES, ...SPG_MODULES, ...SEASONAL_MODULES, ...SERVICE_MANAGER_MODULES].filter((m) => m.icon === "🧊").map((m) => m.id)).toEqual(["bar8", "m9"]);
  });
  it("у бара шесть уроков, у менеджера семь (плюс «Контроль»); сборка по шагам, диалог, практика на 8, тест на 20", () => {
    expect(B8.lessons.map((l) => l.type)).toEqual(["lesson", "lesson", "lesson", "lesson", "lesson", "lesson", "build", "dialogue", "practice", "quiz"]);
    expect(M9.lessons.map((l) => l.type)).toEqual(["lesson", "lesson", "lesson", "lesson", "lesson", "lesson", "lesson", "build", "dialogue", "practice", "quiz"]);
    expect(les(B8).map((l) => l.title)).toEqual(TITLES);
    expect(les(M9).map((l) => l.title)).toEqual([...TITLES, "Контроль: смена, неделя, месяц"]);
    for (const m of [B8, M9]) {
      expect(les(m, "quiz")[0].questions.length).toBe(20);
      expect(les(m, "practice")[0].situations.length).toBe(8);
      for (const l of les(m)) expect(l.content.length, l.id).toBeGreaterThan(900);
      expect(m.lessons.find((l) => l.type === "dialogue")).toMatchObject({ dialogueId: "bar-b8-1", title: "Живой диалог: «тут точно 50?»" });
    }
    expect(B8.lessons.find((l) => l.type === "build")).toMatchObject({ id: "bar8-build", title: "Сборка: бой стекла у льда", buildId: "glass-ice", role: "bar", mod: "bar8", flow: true });
    expect(M9.lessons.find((l) => l.type === "build")).toMatchObject({ id: "m9-build", title: "Сборка: поломка на смене", buildId: "breakdown-admin", role: "manager", mod: "m9", flow: true });
  });
  it("уроки 1–6 у бара и менеджера — один текст (правишь один — правь оба)", () => {
    for (let i = 0; i < 6; i++) expect(les(M9)[i].content, TITLES[i]).toBe(les(B8)[i].content);
    expect(rd("data/modules-bar.js")).toContain("правишь здесь — поправь и там (tests/v143 сверяет)");
    expect(rd("data/modules-manager.js")).toContain("правишь здесь — поправь и там (tests/v143 сверяет)");
  });
  it("индекс уроков собран скриптом и знает обе темы", () => {
    for (const [r, m] of [["bar", B8], ["manager", M9]]) {
      const idx = MODULES_INDEX[r].find((x) => x.id === m.id);
      expect(idx.title).toBe(m.title);
      expect(idx.lessons.map((l) => l.id)).toEqual(m.lessons.map((l) => l.id));
    }
  });
});

describe("v143 (Доп. 462): содержание — стандарт холдинга, СанПиН 2.3/2.4.4282-26 и ПП РФ № 1515", () => {
  it("инвентарь: одна мерка — одна порция, мерный стакан на баре (ПП № 1515, п. 18), гейзеры на ночь, термометр не ртутный", () => {
    for (const s of ["одна мерка — одна порция. После сиропов и сливок ополаскиваем", "Мерный стакан всегда на баре. Гость вправе проверить объём своей порции, а заведение обязано дать ему средство измерения (ПП РФ № 1515, п. 18)",
      "На ночь гейзеры снимаем и моем, бутылки закрываем пробками", "Совок для льда храним вне льда, в держателе", "только для стекла: не для рук и не для стойки",
      "термометр, не ртутный (СанПиН 2.3/2.4.4282-26, п. 40, 48)"]) expect(TXT, s).toContain(s);
  });
  it("лёд: питьевая вода (п. 13), только совком, ничего в бункере, бой стекла по шагам — весь лёд в утиль", () => {
    for (const s of ["вода для производства, мытья посуды и оборудования должна быть питьевой (СанПиН 2.3/2.4.4282-26, п. 13)", "Набираем только совком",
      "не храним и не охлаждаем бутылки, фрукты и посуду", "Лёд из бокала гостя повторно не используем", "Весь лёд из ванны или бункера утилизируем, даже если осколков не видно",
      "мелкие — влажной бумажной салфеткой; руками не берём", "Ёмкость моем горячей водой, осматриваем при ярком свете и дезинфицируем", "Засыпаем свежий лёд и сообщаем администратору"]) expect(TXT, s).toContain(s);
  });
  it("стекло: скол — в утиль (норматив холдинга), полировка за ножку, хранение вверх дном, термошок, посуда гостей отдельно (п. 29)", () => {
    for (const s of ["Бокал со сколом сразу утилизируем", "(норматив холдинга)", "Держим за ножку или основание, края не касаемся", "Вверх дном, на решётках или ковриках",
      "Не в стопках", "термошок, от него стекло трескается", "Посуду гостей моем отдельно от кухонной (СанПиН 2.3/2.4.4282-26, п. 29)", "с надписью «Стекло»"]) expect(TXT, s).toContain(s);
  });
  it("уход: сроки стандарта и пункты СанПиН (21, 35, 37, 38, 46, 47); под пунктом СанПиН — только то, что в нём есть (сверка 07.11)", () => {
    for (const s of ["протираем и продуваем после каждого вспенивания", "промываем группы с моющим средством, чистим холдеры и сетки", "Кофемолка: чистим бункер и жернова",
      "в начале смены проверяем температуру мойки и ополаскивания и дозировку средств (по инструкции к машине)",
      "моем всю посуду в режиме с дезинфекцией и максимальной температурой (СанПиН 2.3/2.4.4282-26, п. 37), затем сливаем воду и чистим фильтры",
      "не реже раза в 14 дней и при смене сорта (норматив холдинга)", "опорожняем, моем и дезинфицируем бункер и узлы (норматив холдинга)", "Первую партию льда утилизируем, мойку отмечаем в графике",
      "записываем температуру в журнал (СанПиН, п. 35)", "влажная уборка с моющими и дезинфицирующими средствами (СанПиН, п. 21); испачкали — убираем сразу (норматив холдинга)",
      "СанПиН (п. 38) требует обрабатывать аппараты для напитков по инструкции изготовителя, моющими и дезинфицирующими средствами. Стандарт холдинга может требовать чаще инструкции, но не реже",
      "не допускаем их попадания в напитки (СанПиН, п. 46)", "название средства, концентрацию, дату приготовления и срок годности (п. 47)"]) expect(TXT, s).toContain(s);
    // температуры стаканомойки — по инструкции к машине: цифр в уроках нет
    expect(TXT).not.toMatch(/\d\d\s*°C/);
  });
  it("безопасность: мокрые руки, искрящая розетка, чистим отключённое (кроме программ промывки), CO2 — по стандарту и инструкции поставщика", () => {
    for (const s of ["Включать оборудование мокрыми руками", "от искрящей розетки: такое оборудование не используем", "Чистим, разбираем и протираем только отключённое от сети",
      "Исключение — программы промывки, которые по инструкции производителя идут на включённой машине, например промывка групп кофемашины",
      "Правила — норматив холдинга и инструкция поставщика газа", "закреплёнными цепью или хомутом", "с колпаком на вентиле, в проходах не ставим", "Меняет баллон только обученный сотрудник",
      "снимаем редуктор и проверяем прокладку", "Новый баллон ставим и закрепляем цепью", "мыльным раствором: пузыри — утечка", "CO2 тяжелее воздуха и скапливается внизу",
      "назначает управляющий", "розетку обесточивают автоматом в щитке", "🟡 Шипение, а самочувствие нормальное: закрываем вентиль, если он рядом, и выходим",
      "🔴 Одышка или головокружение: сразу выходим и выводим всех, к вентилю не идём", "Человек упал — за ним не спускаемся, звоним 112"]) expect(TXT, s).toContain(s);
    // сверка 07.11: с симптомами к вентилю не идём (в стандарте — сначала вентиль); в практике верный — «сразу выводим всех»
    const co2 = les(B8, "practice")[0].situations.find((x) => /кружится голова/.test(x.scene || ""));
    expect(co2.options[co2.correct]).toBe("Сразу выводим всех из подвала");
  });
  it("поломка: отключить, табличка, администратору, Битрикс24 в ту же смену, сами не ремонтируем; семь «не делаем»; сдача бара", () => {
    for (const s of ["Отключаем оборудование и вешаем табличку «Не работает»", "Администратор в ту же смену ставит задачу в Битрикс24: что сломалось, когда, фото",
      "Сами не ремонтируем и не снимаем защитные панели", "чек-лист закрытия бара: кофемашина, стаканомойка, краны, блендер, соковыжималка"]) expect(TXT, s).toContain(s);
    expect(les(B8)[5].content.split("\n").filter((l) => l.startsWith("🚫 Не ")).length).toBe(7);
  });
  it("менеджеру «Контроль»: смена, неделя, месяц, чек-лист наставника из девяти пунктов, «Заполнить» — через «Структуру»", () => {
    const c = les(M9)[6].content;
    for (const s of ["Проверяет чек-лист закрытия бара", "График мойки льдогенератора", "График промывки пивных линий", "По понедельникам «Утро руководителя» напоминает об этой проверке",
      "Раз в месяц — управляющий", "В первый понедельник месяца «Утро руководителя» напоминает и об этом", "«О нас» → «Структура»"]) expect(c, s).toContain(s);
    const mentor = c.split("**Новичок за баром: чек-лист наставника**")[1].split("\n\n")[0].split("\n").filter((l) => l.startsWith("☑"));
    expect(mentor.length).toBe(9);
  });
  it("«В приложении» — реальные экраны: «Чек-листы» → «Закрытие», «Справочник» → «Кофе», Наставник", () => {
    for (const s of ["«Чек-листы» → «Закрытие»: пункт «Бар: кофемашина, стаканомойка, краны, блендер»", "«Справочник» → «Кофе» → «Чистота машины = вкус в чашке»", "спроси Наставника"]) expect(TXT, s).toContain(s);
    expect(REFERENCE_COFFEE_COURSE.lessons.map((l) => l.title)).toContain("Чистота машины = вкус в чашке");
  });
  it("маркеры строк — из набора приложения, без звёздочек; без «!»", () => {
    for (const m of [B8, M9]) for (const l of les(m)) {
      expect(l.content, l.id).not.toContain("!");
      for (const line of l.content.split("\n")) if (MARKER_RE.test(line)) expect(line, l.id).not.toContain("**");
    }
  });
  it("тест и практика: варианты почти одной длины, верный не угадывается (как tests/v38)", () => {
    for (const m of [B8, M9]) for (const l of m.lessons) {
      const items = l.type === "quiz" ? l.questions.map((q) => ({ o: q.options, c: q.correct }))
        : (l.situations || []).filter((s) => s.genre !== "truefalse").map((s) => ({ o: s.options, c: s.correct }));
      for (const it of items) {
        const L = it.o.map((x) => x.length), mx = Math.max(...L), mn = Math.min(...L);
        if (mx <= 24) expect(mx - mn, l.id + " " + L.join("/")).toBeLessThanOrEqual(8);
        else expect(mx / mn, l.id + " " + L.join("/")).toBeLessThanOrEqual(1.3);
        expect(answerTell(it.o, it.c), l.id).toBe(false);
      }
      // верный — не всегда на одном месте
      if (l.type === "quiz") expect(new Set(l.questions.map((q) => q.correct)).size, l.id).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("v143 (Доп. 462): сборки, диалог, глоссарий, отзывы, план новичка", () => {
  it("«Сборка: бой стекла у льда» у бара и «Сборка: поломка на смене» у менеджера — по шагам, пять стадий, в каждом шаге один верный", () => {
    const g = BUILDS.find((x) => x.id === "glass-ice"), b = BUILDS.find((x) => x.id === "breakdown-admin");
    expect(g).toMatchObject({ mod: "bar8", role: "bar", vis: "flow", title: "Бой стекла у льда" });
    expect(b).toMatchObject({ mod: "m9", role: "manager", vis: "flow", title: "Поломка на смене" });
    expect(g.stages.map((s) => s.n)).toEqual(["Стоп", "Лёд", "Осколки", "Ёмкость", "Свежий лёд"]);
    expect(b.stages.map((s) => s.n)).toEqual(["Отключить", "Табличка", "Заявка", "Посуда", "Передача"]);
    const terms = GLOSSARY.map((x) => x.term.toLowerCase());
    for (const sc of [g, b]) {
      expect(sc.steps.length).toBe(5);
      for (const s of sc.steps) {
        expect(s.options.filter((o) => o.ok).length, s.label).toBe(1);
        const L = s.options.map((o) => o.t.length);
        expect(Math.max(...L) / Math.min(...L), s.label).toBeLessThanOrEqual(1.3);
        for (const o of s.options) expect(o.fb.length, s.label).toBeGreaterThan(10);
        expect(terms, s.term).toContain(s.term.toLowerCase());
      }
    }
    // «Отключить» — новый значок вилки в наборе сборки; остальные стадии — из прежнего набора
    const ic = rd("ui/icons.jsx");
    expect(ic).toContain('<path d="M6.4 7.4h11.2v3.4a5.6 5.6 0 0 1-11.2 0V7.4z" />');
    for (const s of [...g.stages, ...b.stages]) expect(ic, s.ic).toMatch(new RegExp("\\n  " + s.ic + ": \\(c(, s=\\d+)?\\) =>"));
    // посуда без машины — вручную с дезинфекцией (СанПиН, п. 37), посуда гостей — отдельно от кухонной (п. 29)
    const dish = b.steps.find((s) => s.label === "Посуда");
    expect(dish.options.find((o) => o.ok).fb).toContain("СанПиН (п. 37)");
    expect(dish.options.map((o) => o.fb).join(" ")).toContain("(СанПиН, п. 29)");
  });
  it("живой диалог «Тут точно 50?»: четыре выбора, свой уход, верный путь до хорошего настроения", () => {
    const d = DIALOGUES_DATA.find((x) => x.id === "bar-b8-1");
    expect(d).toMatchObject({ termKey: "бар-б8", title: "«Тут точно 50?»", icon: "🧊" });
    expect(d.guest).toMatchObject({ name: "Вадим", mood: 2, walkTitle: "Вадим ушёл" });
    const ch = d.steps.filter((s) => s.type === "choice");
    expect(ch.length).toBe(4);
    for (const s of ch) {
      expect(s.options.filter((o) => o.correct).length).toBe(1);
      const L = s.options.map((o) => o.text.length);
      expect(Math.max(...L) / Math.min(...L)).toBeLessThanOrEqual(1.3);
      expect(answerTell(s.options)).toBe(false);
    }
    expect(d.guest.mood + ch.reduce((a, s) => a + s.options.find((o) => o.correct).moodDelta, 0)).toBeGreaterThanOrEqual(5);
    expect(ch[0].options.find((o) => o.correct).feedback).toContain("(ПП РФ № 1515, п. 18)");
    expect(DIALOGUES_DATA.filter((x) => x.termKey === "бар-б8").length).toBe(1);
  });
  it("глоссарий: 12 новых терминов, каждый один раз, и они есть в уроках", () => {
    const low = TXT.toLowerCase();
    for (const t of ["Мерный стакан", "Льдогенератор", "Стаканомоечная машина", "Холдер", "Паровая трубка", "Пивная линия", "Баллон CO2", "Редуктор", "Рабочий раствор", "Журнал температур", "Термошок", "Битрикс24"]) {
      const g = GLOSSARY.filter((x) => x.term === t);
      expect(g.length, t).toBe(1);
      expect(g[0].def.length, t).toBeGreaterThan(40);
      expect(["Зал и операционка", "Вино и бар", "Посуда и сервировка"]).toContain(g[0].cat);
      expect(low, t).toContain(t.toLowerCase().slice(0, 6));
    }
  });
  it("«Книга отзывов» у обеих тем, план новичка: у бара гигиена → bar8", () => {
    for (const k of ["bar8", "m9"]) { const rv = MODULE_REVIEWS[k]; expect(rv && rv.text.length > 60 && rv.guest && rv.table, k).toBeTruthy(); }
    expect(NB_COMP_MODULES.bar["Гигиена и безопасность"]).toBe("bar8");
    expect(NB_COMP_MODULES.bar["Гигиена и стандарты"]).toBe("bar8");
    expect(NB_COMP_MODULES.bar["Общие стандарты"]).toBe("bar1");   // прежнее — как было
    expect(NB_COMP_MODULES.bar["Честность и деньги"]).toBe("bar7");
    expect(NB_COMP_MODULES.manager["Гигиена и безопасность"]).toBe("m5");
  });
  it("значки у ситуаций практики — из прежнего набора", () => {
    for (const s of [...les(B8, "practice")[0].situations, ...les(M9, "practice")[0].situations]) expect(iconForEmoji(s.emoji), s.emoji).toBeTruthy();
    expect(iconForEmoji("🧊")).toBe("thermo");
  });
});

describe("v143 (Доп. 463): чек-лист «Закрытие» и «Утро руководителя» по понедельникам", () => {
  it("«Закрытие» — восемь пунктов: «Бар: …» после ЕГАИС; «Открытие» и «Предсменка» как были", () => {
    expect(DEFAULT_CHECKLISTS.close.map((x) => x.id)).toEqual(["c1", "c2", "c7", "c8", "c3", "c4", "c5", "c6"]);
    expect(DEFAULT_CHECKLISTS.close.find((x) => x.id === "c8").text).toBe("Бар: кофемашина, стаканомойка, краны, блендер");
    expect(DEFAULT_CHECKLISTS.open.length).toBe(7);
    expect(DEFAULT_CHECKLISTS.preshift.length).toBe(5);
    expect(clLeftLine(clLeft(DEFAULT_CHECKLISTS.close, ["c1", "c2", "c7"]))).toBe("Не отмечено: «Бар: кофемашина, стаканомойка, краны, блендер», «Техника и свет выключены» и ещё 3");
  });
  it("понедельник — недельная проверка, первый понедельник месяца — и месячная, остальные дни — ничего", () => {
    expect(eqpChecks("2026-11-09")).toEqual([EQP_WEEK]);              // понедельник
    expect(eqpChecks("2026-11-02")).toEqual([EQP_WEEK, EQP_MONTH]);   // первый понедельник ноября
    expect(eqpChecks("2026-12-07")).toEqual([EQP_WEEK, EQP_MONTH]);   // седьмое — тоже первый
    expect(eqpChecks("2026-12-14")).toEqual([EQP_WEEK]);
    for (const d of ["2026-11-07", "2026-11-08", "2026-11-10", "2026-12-08", "", null, "2026-13-02", "2026-02-30", "09.11.2026"]) expect(eqpChecks(d), String(d)).toEqual([]);
    expect(EQP_WEEK).toMatchObject({ k: "eqp-week", title: "Раз в неделю: график мойки льдогенератора и пивных линий" });
    expect(EQP_MONTH).toMatchObject({ k: "eqp-month", title: "Раз в месяц: оборудование и заявки в Битрикс24" });
    expect(EQP_LESSON).toEqual({ mod: "m9", id: "m9-7" });
    expect(M9.lessons.find((l) => l.id === EQP_LESSON.id).title).toBe("Контроль: смена, неделя, месяц");
  });
  it("«Утро»: строки в «Сегодня» после брифинга, ведут в «Контроль», если тема есть в программе", () => {
    const s = rd("ui/morning.jsx");
    expect(s).toContain('import { eqpChecks, EQP_LESSON } from "../lib/equip-checks";');
    expect(s).toContain('{eqpChecks(b.day).map((x) => row(x.k, "info", x.title, { icon: "calendar", sub: x.sub, go: lessonOn ? () => onGo("lesson", EQP_LESSON) : null }))}');
    expect(s.indexOf("eqpChecks(b.day)")).toBeGreaterThan(s.indexOf("Собрать брифинг</button>"));
    expect(s.indexOf("eqpChecks(b.day)")).toBeLessThan(s.indexOf('h("На неделе"'));
    const a = rd("App.jsx");
    expect(a).toContain('else if (dest === "lesson" && x && x.mod) {');
    expect(a).toContain('lessonOn={!!(programModules || []).find((mm) => mm.id === "m9")}');
  });
});

describe("v143 (Доп. 463): Наставник по стандарту, «Справочник», «О нас» → «Структура», демо", () => {
  it("вопрос про лёд, стекло, мойку, CO2, поломку — да; про вино, коктейль, «сколько стоит», кроссовки — нет", () => {
    for (const q of ["Чем набирать лёд?", "Над ванной разбился бокал, что делать?", "Как часто мыть кофемашину", "Как поменять баллон CO2", "баллон СО2 шипит", "Сломалась стаканомойка",
      "бокал со сколом можно подать?", "Как часто промывать пивные линии", "Где хранить совок", "Какой термометр в холодильник", "Гость просит проверить объём", "недолив виски",
      "Как мыть льдогенератор", "что писать на рабочем растворе", "кофемолку когда чистить", "паровую трубку когда чистить", "не работает блендер"]) expect(eqpAsked(q), q).toBe(true);
    for (const q of ["Сколько стоит виски?", "Какое вино посоветовать к тартару?", "Расскажи про Негрони", "сколько льда в мохито", "Что надеть, кроссовки можно?", "Как подать игристое",
      "Какой маркой виски лучше", "Что делать, если у бутылки нет марки?"]) expect(eqpAsked(q), q).toBe(false);
    expect(rcvAsked("Что делать, если у бутылки нет марки?")).toBe(true);
  });
  it("к вопросу добавляется стандарт (без меню, «Барной карты» и коктейлей; глава Справочника остаётся), сообщение до 2000 знаков", () => {
    const out = withRefContext([{ role: "user", content: "Как часто мыть кофемашину?" }], { restaurant: "Два моря, Океан", position: "bartender" }, { position: "бармен", roleTitle: "Бар", total: 100, done: 3 });
    const c = out[0].content;
    expect(c.startsWith("Как часто мыть кофемашину?\n\n[Твой собеседник")).toBe(true);
    expect(c).toContain(EQP_LINE);
    expect(c).not.toContain("Барной карты");
    expect(c).not.toContain("Колоды бармена");
    expect(c).toContain("«Чистота машины = вкус в чашке» (курс «Кофе»)");
    expect(c.length).toBeLessThanOrEqual(2000);
    expect(EQP_LINE.length).toBeLessThanOrEqual(800);
    for (const s of ["лёд только совком, совок вне льда", "бой стекла у льда: весь лёд в утиль", "группы с моющим средством каждую смену", "трубка после каждого вспенивания",
      "пивные линии не реже раза в 14 дней и при смене сорта", "CO2 меняет только обученный", "одышка или головокружение у баллонов: сразу выйти и вывести всех", "заявка в Битрикс24 в ту же смену, сами не чиним", "остальное по инструкции производителя.]"]) expect(EQP_LINE, s).toContain(s);
    const both = withRefContext([{ role: "user", content: "Как подключить кегу и поменять баллон CO2?" }], { restaurant: "Два моря, Океан" }, { position: "бармен", roleTitle: "Бар", total: 100, done: 3 });
    expect(both[0].content).toContain(RCV_LINE);
    expect(both[0].content).toContain(EQP_LINE);
    expect(both[0].content.length).toBeLessThanOrEqual(2000);
    const pair = withRefContext([{ role: "user", content: "Какое вино посоветовать к тартару?" }], { restaurant: "Два моря, Океан" }, null);
    expect(pair[0].content).not.toContain("[Стандарт холдинга, оборудование бара");
  });
  it("«Справочник» → «Кофе» → «Чистота машины»: блок «По стандарту холдинга»", () => {
    const l = REFERENCE_COFFEE_COURSE.lessons.find((x) => x.id === "cof-care");
    for (const s of ["**По стандарту холдинга**", "• Группы с моющим средством, холдеры и сетки — в конце каждой смены.", "• Паровая трубка — протереть и продуть после каждого вспенивания.",
      "• Кофемолка: бункер и жернова — раз в неделю.", "• Накипь и фильтр воды — по инструкции производителя.", "тема «Инвентарь и оборудование бара» в уроках бара и менеджера"]) expect(l.content, s).toContain(s);
    expect(l.content.indexOf("**По стандарту холдинга**")).toBeLessThan(l.content.indexOf("📌"));
  });
  it("«О нас» → «Структура»: подсказка — поставки, баллоны CO2, ремонт техники", () => {
    expect(CN_KINDS.find((k) => k.kind === "structure").hint).toBe("Руководители, к кому с каким вопросом: поставки (ЕГАИС и ЭДО), баллоны CO2, ремонт техники");
  });
  it("демо: Наставник отвечает по стандарту без нейросети; проверка демо — раздел «equip» с понедельником", () => {
    const s = rd("tools/claude/demo-app/boot.js");
    expect(s).toContain("function demoEqp(q)");
    expect(s).toContain('if (q0.includes("[Стандарт холдинга, оборудование бара")) return wait(900).then(() => json({ ok: true, reply: demoEqp(q0), model: "demo" }));');
    const c = rd("tools/claude/demo-app/check.mjs");
    expect(c).toContain('if (!ONLY || ONLY.includes("equip")) {');
    expect(c).toContain('ok("демо: у Марии понедельник", dow === 1, String(dow));');
  });
});

describe("v143: правила текста и выпуск", () => {
  it("новые и изменённые файлы: без ритма « — » в строках и без эмодзи", () => {
    for (const f of ["lib/equip-checks.js", "lib/checklists.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(/\p{Extended_Pictographic}/u.test(code(rd(f))), f).toBe(false);
    }
    for (const t of [EQP_LINE, EQP_WEEK.title, EQP_WEEK.sub, EQP_MONTH.title, EQP_MONTH.sub]) {
      expect(dashes(JSON.stringify(t)), t).toBe(0);
      expect(/\p{Extended_Pictographic}/u.test(t), t).toBe(false);
    }
  });
  it("CHANGES и README проверок", () => {
    const ch = rd("CHANGES.md");
    for (const n of ["462", "463"]) expect(ch).toContain("# Дополнение " + n);
    expect(rd("tools/claude/README.md")).toContain("`e2e-v143.mjs`");
  });
});
