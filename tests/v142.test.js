// v142: тема «Приём и хранение: ЕГАИС, «Честный знак», марки» у бара (Урок 7) и у менеджера (Урок 8) по «Стандартам холдинга»,
// модуль 17 (Доп. 460), и связи с приложением (Доп. 461): «Хранение» на карточке «Барной карты», новые пункты чек-листов по
// умолчанию, «Утро руководителя» называет, что вчера не отмечено, Наставник отвечает по стандарту приёмки.
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
import { NB_COMP_MODULES } from "../lib/newbie";
import { MOD_SVG, MARKER_RE } from "../ui/icons";
import { iconForEmoji } from "../lib/situation-icons";
import { answerTell } from "../lib/answer-tell";
import { storeOf, openKind, KEEP, OPEN_LIFE, STICKER } from "../lib/bar-storage";
import { DEFAULT_CHECKLISTS, CL_KINDS, clLeft, clLeftLine } from "../lib/checklists";
import { withRefContext, rcvAsked, RCV_LINE } from "../lib/reference-context";
import { CN_KINDS } from "../lib/concept";

const rd = (p) => readFileSync(p, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const B7 = BAR_MODULES.find((m) => m.id === "bar7");
const M8 = MANAGER_MODULES.find((m) => m.id === "m8");
const les = (m, t = "lesson") => m.lessons.filter((l) => l.type === t);
const TXT = les(M8).map((l) => l.content).join("\n");
const TITLES = ["Приёмка: накладная, марки, ответ в ЕГАИС", "Расхождения: недовоз, бой, бутылка без марки", "Касса и списание в ЕГАИС",
  "«Честный знак»: пиво, кеги, вода, соки, молоко", "Хранение: лицензия, условия, вскрытые бутылки", "Ответственность: штрафы и шесть правил"];

describe("v142 (Доп. 460): тема в конце треков бара и менеджера, прежнее не тронуто", () => {
  it("бар — восьмая тема «Урок 7», менеджер — девятая «Урок 8»; остальные треки как были", () => {
    expect(BAR_MODULES.map((m) => m.id)).toEqual(["bar0", "bar1", "bar2", "bar3", "bar4", "bar5", "bar6", "bar7"]);
    expect(MANAGER_MODULES.map((m) => m.id)).toEqual(["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]);
    expect([CORE_MODULES.length, SPG_MODULES.length, SEASONAL_MODULES.length, SERVICE_MANAGER_MODULES.length]).toEqual([7, 11, 14, 7]);
    for (const [m, tag, sub, first] of [[B7, "Урок 7", "Накладные, марки, кеги, касса, лицензия и сроки", BAR_MODULES[0]], [M8, "Урок 8", "Приёмка, касса, кеги, лицензия и контроль смены", MANAGER_MODULES[0]]]) {
      expect(m).toMatchObject({ tag, title: "Приём и хранение: ЕГАИС, «Честный знак», марки", subtitle: sub, icon: "📦" });
      expect(typeof MOD_SVG[m.icon]).toBe("function");
      expect(m.color).toBe(first.color);
    }
  });
  it("у бара шесть уроков, у менеджера семь (плюс «Контроль»); сборка, диалог, практика на 8, тест на 20", () => {
    expect(B7.lessons.map((l) => l.type)).toEqual(["lesson", "lesson", "lesson", "lesson", "lesson", "lesson", "build", "dialogue", "practice", "quiz"]);
    expect(M8.lessons.map((l) => l.type)).toEqual(["lesson", "lesson", "lesson", "lesson", "lesson", "lesson", "lesson", "build", "dialogue", "practice", "quiz"]);
    expect(les(B7).map((l) => l.title)).toEqual(TITLES);
    expect(les(M8).map((l) => l.title)).toEqual([...TITLES, "Контроль: смена, месяц, документы"]);
    for (const m of [B7, M8]) {
      expect(les(m, "quiz")[0].questions.length).toBe(20);
      expect(les(m, "practice")[0].situations.length).toBe(8);
      for (const l of les(m)) expect(l.content.length, l.id).toBeGreaterThan(900);
      expect(m.lessons.find((l) => l.type === "dialogue").dialogueId).toBe("bar-b7-1");
    }
    expect(B7.lessons.find((l) => l.type === "build")).toMatchObject({ id: "bar7-build", buildId: "receive-bar", role: "bar", mod: "bar7", flow: true });
    expect(M8.lessons.find((l) => l.type === "build")).toMatchObject({ id: "m8-build", buildId: "receive-admin", role: "manager", mod: "m8", flow: true });
  });
  it("уроки 1–6 у бара и менеджера — один текст (правишь один — правь оба)", () => {
    for (let i = 0; i < 6; i++) expect(les(M8)[i].content, TITLES[i]).toBe(les(B7)[i].content);
    expect(rd("data/modules-bar.js")).toContain("правишь здесь — поправь и там (tests/v142 сверяет)");
    expect(rd("data/modules-manager.js")).toContain("правишь здесь — поправь и там (tests/v142 сверяет)");
  });
  it("индекс уроков собран скриптом и знает обе темы", () => {
    for (const [r, m] of [["bar", B7], ["manager", M8]]) {
      const idx = MODULES_INDEX[r].find((x) => x.id === m.id);
      expect(idx.title).toBe(m.title);
      expect(idx.lessons.map((l) => l.id)).toEqual(m.lessons.map((l) => l.id));
    }
  });
});

describe("v142 (Доп. 460): содержание — стандарт холдинга и закон на ноябрь 2026 года", () => {
  it("приёмка: скан каждой марки, три ответа на ТТН, сроки по закону и по стандарту, сбой УТМ", () => {
    for (const s of ["Сканируем марку каждой бутылки и сверяем с ТТН в ЕГАИС — так требует стандарт холдинга", "«принято», «принято с расхождениями» или «отказано»",
      "По закону — не позднее следующего рабочего дня после приёмки. Стандарт холдинга — в день поставки.", "не вскрываем, пока ТТН не подтверждена",
      "дежурную службу ЕГАИС", "Федеральная специальная марка (ФСМ) — на российском алкоголе, акцизная — на импортном"]) expect(TXT, s).toContain(s);
  });
  it("расхождения: без марки не принимаем, акт с экспедитором, штраф за немаркированный алкоголь", () => {
    for (const s of ["Бутылку без марки или с повреждённой маркой не принимаем ни в каком виде", "Составляем акт расхождений с экспедитором, подписываем оба",
      "штраф организации от 1 до 1,5 млн ₽", "Подпись до пересчёта — согласие с тем, что всё привезли целым"]) expect(TXT, s).toContain(s);
  });
  it("касса и списание: каждая продажа — в ЕГАИС с 1 июля 2024 года, вскрытие не регистрируют, акт — следующий рабочий день, пивные акты остаются", () => {
    for (const s of ["С 1 июля 2024 года общепит передаёт в ЕГАИС каждую продажу алкоголя, а вскрытие отдельно не регистрирует",
      "Сканируем марку бутылки, из которой наливаем, в чеке — объём в мл", "Срок — не позднее следующего рабочего дня после первичного документа о списании, например акта о бое",
      "в феврале 2026 года Росалкогольтабакконтроль это отозвал. Акты подаём, как раньше"]) expect(TXT, s).toContain(s);
  });
  it("«Честный знак»: УПД, кега — не позднее следующего рабочего дня, вывод из оборота — 3 рабочих дня, молоко — номер партии с 1 ноября 2026, просроченное", () => {
    for (const s of ["УПД подписываем после пересчёта и проверки кодов, в день поставки — стандарт холдинга", "Срок — не позднее следующего рабочего дня после подключения",
      "в чеке — кега и объём порции", "вывод из оборота за 3 рабочих дня", "С 1 ноября 2026 года у молока и сливок со сроком годности больше 40 суток в выводе из оборота указываем номер партии",
      "(у остального молочного — с 1 марта 2027 года)", "касса проверяет код в «Честном знаке» и получает запрет на просроченное",
      "Продал вопреки запрету — штраф приходит сам, без протокола: у организации — 20 000 ₽ за каждую единицу"]) expect(TXT, s).toContain(s);
    // сверка 07.11 (ПП РФ от 15.06.2026 № 745): с 1 ноября 2026 года молоко — партионный учёт, поштучно — по желанию
    expect(TXT).not.toContain("выводим поштучно");
  });
  it("хранение: адрес из лицензии, условия, температура по новому СанПиН, стикер и сроки вскрытой бутылки (модуль 07)", () => {
    for (const s of ["храним только в месте, указанном в лицензии, и в сезонном зале (171-ФЗ, ст. 18)", "Вино и игристое — 10–14 °C", "Крепкие напитки — 15–20 °C",
      "СанПиН для общепита 2.3/2.4.4282-26, он действует с 1 сентября 2026 года", "дата и время вскрытия, «годен до», подпись",
      "Тихое вино — 3 суток с вакуумной пробкой в холодильнике при 4–6 °C", "Игристое — 1 сутки", "Креплёное и десертное — 14 суток", "В работу первой идёт самая старая открытая бутылка"]) expect(TXT, s).toContain(s);
  });
  it("штрафы — только сверенные суммы (ст. 15.12, ч. 4 и ч. 2, ст. 14.19); за адрес не из лицензии — без цифр", () => {
    for (const s of ["должностному лицу — 300 000–500 000 ₽, организации — 1–1,5 млн ₽", "должностному лицу — 10 000–15 000 ₽, организации — 150 000–200 000 ₽",
      "должностному лицу — 5 000–10 000 ₽, организации — 50 000–300 000 ₽", "это оборот без лицензии: штраф и изъятие продукции"]) expect(TXT, s).toContain(s);
    expect(TXT).not.toContain("14.17");
  });
  it("менеджеру «Контроль»: ответственный в смене, конец смены, сверка трёх систем, журнал — как в стандарте (юрист холдинга)", () => {
    const c = les(M8)[6].content;
    for (const s of ["Отдельного ответственного нет — поставку принимает администратор смены", "У каждой ТТН за день есть ответ", "Сверка остатков iiko, ЕГАИС и «Честного знака»",
      "Цифры не подгоняем", "решает юрист холдинга. Пока ответа нет, журнал не отменяем"]) expect(c, s).toContain(s);
  });
  it("«В приложении» — реальные экраны: «О нас» → «Структура», «Барная карта» → «Хранение», чек-листы, «Утро руководителя», Наставник", () => {
    for (const s of ["«О нас» → «Структура»", "«Барная карта» → карточка вина или крепкого → «Хранение»", "«Чек-листы» → «Открытие»: пункт «Вскрытые бутылки: стикеры и сроки»",
      "«Чек-листы» → «Закрытие»: пункт «ЕГАИС и ЭДО: накладные, УПД, акты за день»", "«Утро руководителя» назовёт пункт чек-листа", "спроси Наставника"]) expect(TXT, s).toContain(s);
    expect(DEFAULT_CHECKLISTS.open.map((x) => x.text)).toContain("Вскрытые бутылки: стикеры и сроки");
    expect(DEFAULT_CHECKLISTS.close.map((x) => x.text)).toContain("ЕГАИС и ЭДО: накладные, УПД, акты за день");
  });
  it("маркеры строк — из набора приложения (без «⚫»), без звёздочек; без «!»", () => {
    for (const m of [B7, M8]) for (const l of les(m)) {
      expect(l.content, l.id).not.toContain("⚫");
      expect(l.content, l.id).not.toContain("!");
      for (const line of l.content.split("\n")) if (MARKER_RE.test(line)) expect(line, l.id).not.toContain("**");
    }
  });
  it("тест и практика: варианты почти одной длины, верный не угадывается (как tests/v38)", () => {
    for (const m of [B7, M8]) for (const l of m.lessons) {
      const items = l.type === "quiz" ? l.questions.map((q) => ({ o: q.options, c: q.correct }))
        : (l.situations || []).filter((s) => s.genre !== "truefalse").map((s) => ({ o: s.options, c: s.correct }));
      for (const it of items) {
        const L = it.o.map((x) => x.length), mx = Math.max(...L), mn = Math.min(...L);
        if (mx <= 24) expect(mx - mn, l.id + " " + L.join("/")).toBeLessThanOrEqual(8);
        else expect(mx / mn, l.id + " " + L.join("/")).toBeLessThanOrEqual(1.3);
        expect(answerTell(it.o, it.c), l.id).toBe(false);
      }
    }
  });
});

describe("v142 (Доп. 460): сборка, диалог, глоссарий, отзывы, план новичка", () => {
  it("«Сборка: приёмка поставки» — одна у бара и менеджера, по шагам, пять стадий, в каждом шаге один верный", () => {
    const b = BUILDS.find((x) => x.id === "receive-bar"), m = BUILDS.find((x) => x.id === "receive-admin");
    expect(b).toMatchObject({ mod: "bar7", role: "bar", vis: "flow", title: "Приёмка поставки" });
    expect(m).toMatchObject({ mod: "m8", role: "manager", vis: "flow", title: "Приёмка поставки" });
    expect(m.steps).toBe(b.steps);
    expect(b.stages.map((s) => s.n)).toEqual(["Накладная", "Марки", "ЕГАИС", "УПД", "Хранение"]);
    expect(b.steps.length).toBe(5);
    const terms = GLOSSARY.map((g) => g.term.toLowerCase());
    for (const s of b.steps) {
      expect(s.options.filter((o) => o.ok).length, s.label).toBe(1);
      const L = s.options.map((o) => o.t.length);
      expect(Math.max(...L) / Math.min(...L), s.label).toBeLessThanOrEqual(1.3);
      for (const o of s.options) expect(o.fb.length, s.label).toBeGreaterThan(10);
      expect(terms, s.term).toContain(s.term.toLowerCase());
    }
    expect(rd("ui/module-menu.jsx")).toContain('if (l.type === "build" && l.flow) return "собери по шагам";');
  });
  it("живой диалог «Экспедитор торопит»: четыре выбора, свой уход, верный путь до хорошего настроения", () => {
    const d = DIALOGUES_DATA.find((x) => x.id === "bar-b7-1");
    expect(d.termKey).toBe("бар-б7");
    expect(d.guest).toMatchObject({ name: "Олег", mood: 2, walkTitle: "Олег уехал" });
    const ch = d.steps.filter((s) => s.type === "choice");
    expect(ch.length).toBe(4);
    for (const s of ch) {
      expect(s.options.filter((o) => o.correct).length).toBe(1);
      const L = s.options.map((o) => o.text.length);
      expect(Math.max(...L) / Math.min(...L)).toBeLessThanOrEqual(1.3);
      expect(answerTell(s.options)).toBe(false);
    }
    expect(d.guest.mood + ch.reduce((a, s) => a + s.options.find((o) => o.correct).moodDelta, 0)).toBeGreaterThanOrEqual(5);
    expect(DIALOGUES_DATA.filter((x) => x.termKey === "бар-б7").length).toBe(1);
  });
  it("глоссарий: 14 новых терминов, каждый один раз, и они есть в уроках", () => {
    const low = TXT.toLowerCase();
    for (const t of ["ЕГАИС", "УТМ", "ТТН", "ФСМ", "Акцизная марка", "Акт расхождений", "Акт списания", "Честный знак", "Код маркировки", "ЭДО", "УПД", "Вывод из оборота", "Подключение кеги", "Лицензия на алкоголь"]) {
      const g = GLOSSARY.filter((x) => x.term === t);
      expect(g.length, t).toBe(1);
      expect(g[0].def.length, t).toBeGreaterThan(40);
      expect(["Зал и операционка", "Вино и бар"]).toContain(g[0].cat);
      expect(low, t).toContain(t.toLowerCase().slice(0, 6));
    }
  });
  it("«Книга отзывов» у обеих тем, план новичка: у бара «Честность и деньги» → bar7", () => {
    for (const k of ["bar7", "m8"]) { const rv = MODULE_REVIEWS[k]; expect(rv && rv.text.length > 60 && rv.guest && rv.table, k).toBeTruthy(); }
    expect(NB_COMP_MODULES.bar["Честность и деньги"]).toBe("bar7");
    expect(NB_COMP_MODULES.bar["Продукт и подача"]).toBe("bar3");   // прежнее — как было
    expect(NB_COMP_MODULES.manager["Честность и деньги"]).toBe("m7");
  });
  it("значки: тема — коробка с отметкой (MOD_SVG «📦»), у ситуаций практики — значки из прежнего набора", () => {
    expect(rd("ui/icons.jsx")).toContain('<path d="M14.4 15.3l1.6 1.5 2.7-3.1" />');
    expect(iconForEmoji("🍷")).toBe("glass");
    expect(iconForEmoji("⏱️")).toBe("clock");
    expect(iconForEmoji("⚠️")).toBe("alert");
  });
});

describe("v142 (Доп. 461): «Хранение» на карточке «Барной карты»", () => {
  it("вино: условия и срок вскрытой по типу, стикер; без цвета — без срока", () => {
    const w = (color) => storeOf("wine", { color });
    expect(w("red")).toEqual({ keep: KEEP.wine, open: OPEN_LIFE.still, sticker: STICKER });
    for (const c of ["white", "rose", "orange"]) expect(openKind("wine", { color: c })).toBe("still");
    expect(w("sparkling").open).toBe("1 сутки с пробкой для игристого, в холодильнике");
    expect(w("fortified").open).toBe("14 суток с плотной пробкой");
    expect(w("dessert").open).toBe("14 суток с плотной пробкой");
    expect(w("other")).toEqual({ keep: KEEP.wine, open: null, sticker: STICKER });
    expect(w("").open).toBe(null);
    expect(KEEP.wine).toBe("10–14 °C, бутылки с пробкой лёжа, без света, вибрации и посторонних запахов");
    expect(OPEN_LIFE.still).toBe("3 суток с вакуумной пробкой, в холодильнике при 4–6 °C");
  });
  it("крепкое: 15–20 °C; ликёр — срок по маркировке и стикер, остальное — без", () => {
    expect(storeOf("spirit", { cat: "liqueur" })).toEqual({ keep: KEEP.spirit, open: "срок после вскрытия по маркировке", sticker: STICKER });
    for (const cat of ["whisky", "gin", "bitter", "vodka", ""]) expect(storeOf("spirit", { cat })).toEqual({ keep: KEEP.spirit, open: null, sticker: null });
    expect(storeOf("cocktail", {})).toBe(null);
    expect(storeOf("wine", null)).toBe(null);
  });
  it("карточка показывает блок под «Подачей»", () => {
    const s = rd("ui/wine-list.jsx");
    expect(s).toContain('import { storeOf } from "../lib/bar-storage";');
    expect(s).toContain("const store = storeOf(K.kind, w);");
    expect(s).toContain('{store ? <>{sec("Хранение")}<div data-wine-store={K.kind}');
    expect(s).toContain("Вскрытая: {store.open}");
    expect(s.indexOf('sec("Хранение")')).toBeGreaterThan(s.indexOf('sec("Подача")'));
  });
});

describe("v142 (Доп. 461): чек-листы по умолчанию и «Утро руководителя»", () => {
  it("«Открытие» — семь пунктов (вскрытые бутылки после бара), «Закрытие» — семь (ЕГАИС и ЭДО после кассы), «Предсменка» как была", () => {
    expect(DEFAULT_CHECKLISTS.open.map((x) => x.id)).toEqual(["o1", "o2", "o3", "o4", "o5", "o7", "o6"]);
    expect(DEFAULT_CHECKLISTS.close.map((x) => x.id)).toEqual(["c1", "c2", "c7", "c3", "c4", "c5", "c6"]);
    expect(DEFAULT_CHECKLISTS.preshift.length).toBe(5);
    expect(CL_KINDS.map(([k]) => k)).toEqual(["open", "preshift", "close"]);
    const ids = Object.values(DEFAULT_CHECKLISTS).flat().map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("что не отмечено: по порядку списка, две позиции и «и ещё N»", () => {
    const items = DEFAULT_CHECKLISTS.close;
    expect(clLeft(items, ["c1", "c2", "c3", "c4"])).toEqual(["ЕГАИС и ЭДО: накладные, УПД, акты за день", "Уборка завершена", "Закрытие и сигнализация"]);
    expect(clLeftLine(clLeft(items, ["c1", "c2", "c3", "c4"]))).toBe("Не отмечено: «ЕГАИС и ЭДО: накладные, УПД, акты за день», «Уборка завершена» и ещё 1");
    expect(clLeftLine(["Касса сведена"])).toBe("Не отмечено: «Касса сведена»");
    expect(clLeftLine(clLeft(items, items.map((x) => x.id)))).toBe(null);
    expect(clLeft(null, null)).toEqual([]);
    expect(clLeft([{ id: "a", text: " Свет " }, { id: "b", text: "" }, null], [])).toEqual(["Свет"]);
  });
  it("«Утро»: строка «Не отмечено» — только у начатого и не законченного чек-листа", () => {
    const s = rd("ui/morning.jsx");
    expect(s).toContain("import { DEFAULT_CHECKLISTS, CL_KINDS, clLeft, clLeftLine } from \"../lib/checklists\";");
    expect(s).toContain("ids: t.map((x) => x.id), items: t };");
    expect(s).toContain("const left = !done && ch ? clLeftLine(clLeft(x.items, x.log.checked)) : null;");
    expect(s).toContain('icon: "checklist", sub: left, go: () => onGo("checklist") }');
  });
});

describe("v142 (Доп. 461): Наставник по стандарту приёмки, «О нас» → «Структура»", () => {
  it("вопрос о приёмке, марках, кегах, УПД, списании, хранении — да; о бренде, вине к блюду, «маркетинге» — нет", () => {
    for (const q of ["Что делать, если у бутылки нет марки?", "Когда отвечать на ТТН в ЕГАИС", "Как подключить кегу?", "УПД подписывать когда", "Расскажи про Честный знак",
      "как списать бой", "сколько хранится открытое вино", "Как хранить вино?", "маркировка воды", "повреждённая марка", "Где хранить алкоголь по лицензии"]) expect(rcvAsked(q), q).toBe(true);
    for (const q of ["Какой маркой виски лучше", "какая марка джина есть", "Какое вино посоветовать к тартару?", "маркетинг кафе", "открытый вопрос", "хранилище", "Кто такой Эдоард"]) expect(rcvAsked(q), q).toBe(false);
  });
  it("к вопросу добавляется стандарт (без меню, «Барной карты» и Справочника), сообщение до 2000 знаков", () => {
    const out = withRefContext([{ role: "user", content: "Что делать, если у бутылки нет марки?" }], { restaurant: "Два моря, Океан", position: "bartender" }, { position: "бармен", roleTitle: "Бар", total: 100, done: 3 });
    const c = out[0].content;
    expect(c.startsWith("Что делать, если у бутылки нет марки?\n\n[Твой собеседник")).toBe(true);
    expect(c).toContain(RCV_LINE);
    expect(c).not.toContain("Барной карты");
    expect(c).not.toContain("курс «");
    expect(c.length).toBeLessThanOrEqual(2000);
    expect(RCV_LINE.length).toBeLessThanOrEqual(650);
    for (const s of ["скан марки каждой бутылки", "ответ на ТТН в ЕГАИС в день поставки (закон: не позднее следующего рабочего дня)", "«принято с расхождениями» и акт",
      "кега: скан кода до подключения", "вывод из оборота за 3 рабочих дня", "только по адресу из лицензии", "тихое вино 3 суток, игристое 1, креплёное 14."]) expect(RCV_LINE, s).toContain(s);
    const pair = withRefContext([{ role: "user", content: "Какое вино посоветовать к тартару?" }], { restaurant: "Два моря, Океан" }, null);
    expect(pair[0].content).not.toContain("[Стандарт холдинга, приём и хранение");
  });
  it("«О нас» → «Структура»: подсказка — кто принимает поставки (ЕГАИС и ЭДО)", () => {
    expect(CN_KINDS.find((k) => k.kind === "structure").hint).toBe("Руководители, к кому с каким вопросом, кто принимает поставки (ЕГАИС и ЭДО)");
  });
  it("демо: Наставник отвечает по стандарту без нейросети", () => {
    const s = rd("tools/claude/demo-app/boot.js");
    expect(s).toContain("function demoRcv(q)");
    expect(s).toContain('if (q0.includes("[Стандарт холдинга, приём и хранение")) return wait(900).then(() => json({ ok: true, reply: demoRcv(q0), model: "demo" }));');
  });
});

describe("v142: правила текста и выпуск", () => {
  it("новые и изменённые файлы: без ритма « — » в строках и без эмодзи", () => {
    for (const f of ["lib/bar-storage.js", "lib/checklists.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(/\p{Extended_Pictographic}/u.test(code(rd(f))), f).toBe(false);
    }
    expect(dashes(RCV_LINE)).toBe(0);
    expect(/\p{Extended_Pictographic}/u.test(RCV_LINE)).toBe(false);
  });
  it("CHANGES и README проверок", () => {
    const ch = rd("CHANGES.md");
    for (const n of ["460", "461"]) expect(ch).toContain("# Дополнение " + n);
    expect(ch).toContain("гоу-лист: 2 функции из 2 · брифингов с гоу-листом: 0 · с итогом: 0");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v142.mjs`");
  });
});
