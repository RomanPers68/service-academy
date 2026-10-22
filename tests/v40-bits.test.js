// v40 («Путь мастера»), мелкие вставки по экранам: знак «Мастер роли ✦» у имени в рейтинге и лиге
// (только коллеги своего заведения), баннер «✦ МАСТЕР РОЛИ» (MastersBanner), место под карточку
// «Путь мастера» на главной (RoleSelect masteryCard), вид «Мастера заведения» в «Что ещё присылать»
// (только если сервер его знает — этап 26), «Шаг дня» в примере напоминания, подсказка mastery,
// кнопка ассистента [[go:mastery]] и «путь мастера» в контексте ассистента.
// Без новых свойств экраны — как были. Вид в браузере (обе темы, 390 px) — в отчёте v40-bits.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const noop = () => {};
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/\u00A0/g, " ");
const DAY = 86400000;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const OKEAN = "Два моря, Океан", PRICHAL = "Два моря, Причал";
const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false };
// строки mastery_list: мастера своего заведения, новые сверху
const ROWS = [
  { who: "Анна Смирнова", name: "Анна", role: "core", at: iso(DAY), me: false },
  { who: "Заяц Екатерина", name: "Заяц", role: "seasonal", at: iso(3 * DAY), me: false },
];
// имя, после которого стоит знак, и подпись знака
const marks = (html) => [...html.matchAll(/>([^<>]+)<\/(?:div|span)><span data-master-mark="" role="img" title="([^"]*)" aria-label="([^"]*)"[^>]*>✦<\/span>/g)].map((m) => ({ name: m[1].trim(), title: m[2], label: m[3] }));
const count = (html, s) => html.split(s).length - 1;

describe("v40: «Мастер роли ✦» в рейтинге", () => {
  const lb = [
    { name: "Анна", surname: "Смирнова", restaurant: OKEAN, position: "waiter", role: "core", avg: 96, total: 4 },
    { name: "Анна", surname: "Смирнова", restaurant: PRICHAL, position: "waiter", role: "core", avg: 90, total: 3 },   // тёзка из другого заведения
    { name: "Иван", surname: "Петров", restaurant: OKEAN, position: "waiter", role: "seasonal", avg: 80, total: 2 },   // не мастер
    { name: "Екатерина", surname: "Заяц", restaurant: OKEAN, position: "waiter", role: "seasonal", avg: 70, total: 2 },   // в списке мастеров — «Заяц Екатерина»
  ];
  const scores = [
    { name: "Анна", surname: "Смирнова", role: "core", pct: 100, score: 8, total: 8, quiz_id: "c1-q", date: "2026-10-01" },
    { name: "Иван", surname: "Петров", role: "core", pct: 50, score: 4, total: 8, quiz_id: "c1-q", date: "2026-10-02" },
  ];
  const profile = { name: "Тест", surname: "Тестов", restaurant: OKEAN, position: "manager", is_admin: true };
  const render = async (extra) => {
    const { LeaderboardScreen } = await import("../ui/screens-gamification");
    return R(h(LeaderboardScreen, { T, leaderboard: lb, scores, profile, onBack: noop, ...extra }));
  };

  it("вся сеть: знак у мастера своего заведения, не у тёзки из другого и не у не-мастера; порядок слов имени не важен", async () => {
    const { mastersIndex } = await import("../lib/mastery");
    store.sa_lb_scope = "net";
    const html = await render({ masters: mastersIndex(ROWS) });
    delete store.sa_lb_scope;
    expect(marks(html)).toEqual([
      { name: "Анна Смирнова", title: "Мастер роли «Ядро» ✦", label: "Мастер роли «Ядро» ✦" },
      { name: "Екатерина Заяц", title: "Мастер роли «Новичок» ✦", label: "Мастер роли «Новичок» ✦" },
    ]);
    expect(count(html, "data-master-mark")).toBe(2);   // тёзка из «Причала» и Иван — без знака
    expect(count(html, ">Анна Смирнова</div>")).toBe(2);
    // знак — сразу после имени, перед значками достижений; цвет — золото надписи
    expect(html).toMatch(/>Анна Смирнова<\/div><span data-master-mark="" role="img" title="Мастер роли «Ядро» ✦" aria-label="Мастер роли «Ядро» ✦" style="[^"]*color:#C8A96E[^"]*">✦<\/span><span title="Ядро команды"/);
  });

  it("моё заведение (по умолчанию): знаки у своих; светлая тема — тёмное золото", async () => {
    const { mastersIndex } = await import("../lib/mastery");
    const html = await render({ masters: mastersIndex(ROWS), T: { ...T, a11y: true } });
    expect(marks(html).map((m) => m.name)).toEqual(["Анна Смирнова", "Екатерина Заяц"]);
    expect(html).toContain('style="display:inline-flex;align-items:center;flex-shrink:0;color:#7A5A1E;font-size:14px;line-height:1">✦</span>');
  });

  it("без masters, с пустым списком и без заведения в профиле — как было, без знака", async () => {
    const { mastersIndex } = await import("../lib/mastery");
    const base = await render({});
    expect(base).not.toContain("data-master-mark");
    expect(await render({ masters: null })).toBe(base);
    expect(await render({ masters: mastersIndex([]) })).toBe(base);
    const noRest = await render({ masters: mastersIndex(ROWS), profile: { ...profile, restaurant: "" } });
    expect(noRest).not.toContain("data-master-mark");
  });

  it("карточка игрока: строка «✦ Мастер роли «Ядро»» под именем (разметка в исходнике; клик — в браузере)", () => {
    const src = readFileSync("ui/screens-gamification.jsx", "utf8");
    expect(src).toContain('{selMaster ? <div data-master-line=""');
    expect(src).toContain('{"✦ " + masterTitle(selMaster).replace(/\\s*✦$/, "")}');
  });

  it("MasterMark: несколько ролей — «Мастер ролей …», пусто — ничего", async () => {
    const { MasterMark } = await import("../ui/screens-gamification");
    expect(R(h(MasterMark, { roles: ["core", "bar"] }))).toContain('title="Мастер ролей «Ядро», «Бар» ✦"');
    expect(R(h(MasterMark, { roles: null }))).toBe("");
    expect(R(h(MasterMark, { roles: [] }))).toBe("");
  });
});

describe("v40: «Мастер роли ✦» в лиге недели", () => {
  const profile = { name: "Екатерина", surname: "Заяц", restaurant: OKEAN, position: "waiter" };
  it("leagueMasterRoles: своё заведение — роли, чужое — нет; своя строка — по имени из профиля", async () => {
    const { leagueMasterRoles } = await import("../ui/league");
    const { mastersIndex } = await import("../lib/mastery");
    const idx = mastersIndex(ROWS);
    expect(leagueMasterRoles(idx, { name: "Анна", surname: "Смирнова", restaurant: OKEAN }, profile)).toEqual(["core"]);
    expect(leagueMasterRoles(idx, { name: "Анна", surname: "Смирнова", restaurant: PRICHAL }, profile)).toBe(null);
    expect(leagueMasterRoles(idx, { name: "Анна", surname: "С.", restaurant: PRICHAL }, profile)).toBe(null);
    expect(leagueMasterRoles(idx, { name: "Иван", surname: "Петров", restaurant: OKEAN }, profile)).toBe(null);
    // «ты» на подиуме: строка сервера может звать иначе — ищем по профилю («Екатерина Заяц» = «Заяц Екатерина»)
    expect(leagueMasterRoles(idx, { me: true, name: "Катя", surname: "З", restaurant: OKEAN }, profile)).toEqual(["seasonal"]);
    expect(leagueMasterRoles(idx, { me: true, name: "Анна", surname: "Смирнова", restaurant: OKEAN }, { ...profile, name: "Пётр", surname: "Лис" })).toBe(null);
    expect(leagueMasterRoles(null, { name: "Анна", surname: "Смирнова", restaurant: OKEAN }, profile)).toBe(null);
    expect(leagueMasterRoles(idx, { name: "Анна", surname: "Смирнова", restaurant: OKEAN }, { ...profile, restaurant: "" })).toBe(null);
    expect(leagueMasterRoles(idx, { name: "Анна", surname: "Смирнова" }, { ...profile, restaurant: "" })).toBe(null);
  });
  it("список и подиум берут знак из leagueMasterRoles; экран с masters и без рисуется одинаково до ответа сервера", async () => {
    const src = readFileSync("ui/league.jsx", "utf8");
    expect(count(src, "const mr = leagueMasterRoles(masters, r, profile);")).toBe(2);   // подиум и строка списка
    expect(count(src, "<MasterMark roles={mr} a11y={a11y}")).toBe(2);
    const { LeagueScreen } = await import("../ui/league");
    const { mastersIndex } = await import("../lib/mastery");
    const T2 = { ...T, modCard: {} };
    const a = R(h(LeagueScreen, { T: T2, a11y: false, profile, activity: {}, onBack: noop }));
    expect(a).toContain("Лига недели");
    expect(R(h(LeagueScreen, { T: T2, a11y: false, profile, activity: {}, onBack: noop, masters: mastersIndex(ROWS) }))).toBe(a);
  });
});

describe("v40: баннер «✦ МАСТЕР РОЛИ»", () => {
  it("вчера: «Анна Смирнова стала мастером роли «Ядро»», «вчера», «Путь мастера ›»; кнопка-карточка", async () => {
    const { MastersBanner } = await import("../ui/home-hubs");
    const html = R(h(MastersBanner, { a11y: false, rows: [ROWS[0]], onOpen: noop }));
    expect(html).toMatch(/^<div class="sa-card sa-pagein" data-ms-banner="" role="button" tabindex="0"/);
    expect(html).toContain(">✦ МАСТЕР РОЛИ<");
    expect(html).toContain(">Анна Смирнова стала мастером роли «Ядро»<");
    expect(html).toContain(">вчера<");
    expect(html).toContain(">Путь мастера ›<");
    expect(html).not.toContain("и ещё");
  });
  it("мужской род — «стал»; сегодня — «сегодня»", async () => {
    const { MastersBanner } = await import("../ui/home-hubs");
    const html = R(h(MastersBanner, { a11y: false, rows: [{ who: "Иван Петров", name: "Иван", role: "seasonal", at: iso(0), me: false }] }));
    expect(html).toContain(">Иван Петров стал мастером роли «Новичок»<");
    expect(html).toContain(">сегодня<");
  });
  it("старше 7 дней, пусто, только своя запись, мусор — ничего (null)", async () => {
    const { MastersBanner } = await import("../ui/home-hubs");
    expect(R(h(MastersBanner, { a11y: false, rows: [{ ...ROWS[0], at: iso(8 * DAY) }] }))).toBe("");
    expect(R(h(MastersBanner, { a11y: false, rows: [] }))).toBe("");
    expect(R(h(MastersBanner, { a11y: false }))).toBe("");
    expect(R(h(MastersBanner, { a11y: false, rows: [{ who: "Тест Тестов", name: "Тест", role: "core", at: iso(1000), me: true }] }))).toBe("");
    expect(R(h(MastersBanner, { a11y: false, rows: [null, 5, { who: "Без даты", role: "core" }, { who: "", role: "core", at: iso(1000) }, { who: "Кривая Дата", role: "core", at: "вчера" }] }))).toBe("");
    expect(R(h(MastersBanner, { a11y: false, rows: "не список" }))).toBe("");
  });
  it("своя запись не в счёт: показан свежий коллега, «3 дня назад»", async () => {
    const { MastersBanner } = await import("../ui/home-hubs");
    const html = R(h(MastersBanner, { a11y: true, rows: [{ who: "Тест Тестов", name: "Тест", role: "core", at: iso(1000), me: true }, ROWS[1]] }));
    expect(html).toContain(">Заяц Екатерина стала мастером роли «Новичок»<");
    expect(html).toContain(">3 дня назад<");
    expect(html).not.toContain("Тест Тестов");
  });
  it("2+ новых мастера: «… · ещё 2 новых мастера за неделю» (люди, а не записи; старые и свои не считаются)", async () => {
    const { MastersBanner } = await import("../ui/home-hubs");
    const rows = [
      { who: "Вера Ким", name: "Вера", role: "bar", at: iso(5 * DAY), me: false },   // не по порядку — сортируем сами
      { who: "Анна Смирнова", name: "Анна", role: "core", at: iso(2 * 3600e3), me: false },
      { who: "Анна Смирнова", name: "Анна", role: "seasonal", at: iso(DAY), me: false },   // та же Анна — вторая роль
      { who: "Иван Петров", name: "Иван", role: "seasonal", at: iso(2 * DAY), me: false },
      { who: "Тест Тестов", name: "Тест", role: "core", at: iso(DAY), me: true },
      { who: "Олег Ру", name: "Олег", role: "bar", at: iso(9 * DAY), me: false },
    ];
    const html = R(h(MastersBanner, { a11y: false, rows }));
    expect(html).toContain(">Анна Смирнова стала мастером роли «Ядро»<");
    expect(html).toContain(" · ещё 2 новых мастера за неделю<");
    const one = R(h(MastersBanner, { a11y: false, rows: rows.slice(1, 4).filter((r) => r.who !== "Иван Петров") }));
    expect(one).not.toContain("и ещё");   // только Анна (две роли) — новых мастеров один
  });
  it("mastersNews / relDay: дни по календарю, род по имени и фамилии", async () => {
    const { mastersNews, relDay } = await import("../ui/home-hubs");
    const now = new Date(2026, 9, 15, 10, 0).getTime();
    const at = (d, hh = 9) => new Date(2026, 9, 15 - d, hh, 0).getTime();
    expect([0, 1, 2, 3, 5, 7].map((d) => relDay(at(d), now))).toEqual(["сегодня", "вчера", "2 дня назад", "3 дня назад", "5 дней назад", "неделю назад"]);
    expect(relDay(new Date(2026, 9, 14, 23, 59).getTime(), now)).toBe("вчера");
    const n = mastersNews([{ who: "Никита Ткачук", role: "bar", at: new Date(at(6, 11)).toISOString() }], now);
    expect(n).toMatchObject({ name: "Никита", surname: "Ткачук", female: false, title: "Бар", when: "6 дней назад", more: 0 });
    expect(mastersNews([{ who: "Мария  Ли", role: "spg", at: new Date(at(1)).toISOString() }], now)).toMatchObject({ who: "Мария Ли", female: true, title: "Хостес", when: "вчера" });
    expect(mastersNews([{ who: "Анна Смирнова", role: "core", at: new Date(at(7, 9)).toISOString() }], now)).toBe(null);   // 7 суток и час назад
    expect(mastersNews([{ who: "Анна Смирнова", role: "core", at: new Date(now + 3600e3).toISOString() }], now)).toMatchObject({ when: "сегодня" });   // часы сервера чуть впереди
  });
  it("светлая тема: метка 11 px, подписи 13 px; тёмная — 10,5 и 12,5", async () => {
    const { MastersBanner } = await import("../ui/home-hubs");
    const sizes = (html) => [...new Set([...html.matchAll(/font-size:([\d.]+)px/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    expect(sizes(R(h(MastersBanner, { a11y: true, rows: ROWS })))).toEqual([11, 13, 15]);
    expect(sizes(R(h(MastersBanner, { a11y: false, rows: ROWS })))).toEqual([10.5, 12.5, 15]);
  });
  it("ICON.mastery: медаль (лента, круг, звезда) — в списке хаба вместо запасной книги", async () => {
    const { HubScreen } = await import("../ui/home-hubs");
    const html = R(h(HubScreen, { T, a11y: false, title: "Я", items: [{ key: "ms", icon: "mastery", label: "Путь мастера", sub: "значков 3 из 14" }] }));
    expect(html).toContain('<circle cx="12" cy="15" r="6"></circle>');
    expect(html).not.toContain('<path d="M8 7h7M8 11h5"></path>');   // ICON.book
  });
});

describe("v40: главная — место под карточку «Путь мастера»", () => {
  const T4 = { ...T, roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };
  const mod = { id: "cms-m-1", title: "Свой раздел", lessons: [{ id: "cms-l-1", type: "lesson", title: "Урок: встреча гостя", content: "Текст" }, { id: "cms-l-1q", type: "quiz", title: "Тест", questions: [{ q: "?", options: ["а", "б"], correct: 0 }] }] };
  const profile = { name: "Анна", surname: "Смирнова", restaurant: OKEAN, position: "waiter" };
  const card = h("div", { "data-test-mastery": "" }, "Путь мастера · 3 из 14 значков");
  const render = async (extra) => {
    const { RoleSelect } = await import("../ui/screens-roleselect");
    return R(h(RoleSelect, { T: T4, a11y: false, profile, role: "seasonal", onSelect: noop, onContinueLesson: noop, customByRole: { seasonal: [mod] }, ...extra }));
  };
  it("карточка — сразу после «Твой трек», в той же обёртке с полями", async () => {
    const html = await render({ masteryCard: card });
    const slot = html.indexOf('<div data-mastery-slot="" style="margin-top:9px"><div data-test-mastery="">Путь мастера · 3 из 14 значков</div></div>');
    expect(slot).toBeGreaterThan(0);
    const cta = html.indexOf('data-now-cta=""');   // v68 (Доп. 381): кнопка — на корешке «Приглашения»
    expect(html.slice(html.indexOf(">", cta) + 1, html.indexOf("</span>", cta))).toBe("Начать");
    expect(cta).toBeGreaterThan(0);
    expect(cta).toBeLessThan(slot);
    expect(slot).toBeLessThan(html.indexOf("Мой график"));
    // обёртка трека: от её начала до места — карточка трека, после места обёртка закрывается
    const wrap = html.lastIndexOf('<div style="padding:0 14px 9px">', slot);
    expect(html.slice(wrap, slot)).toContain("Встреча гостя");
    expect(html.slice(slot).startsWith('<div data-mastery-slot=""')).toBe(true);
    expect(html.slice(slot + '<div data-mastery-slot="" style="margin-top:9px"><div data-test-mastery="">Путь мастера · 3 из 14 значков</div></div>'.length).startsWith("</div>")).toBe(true);
  });
  it("без роли — нет; без masteryCard — главная как была", async () => {
    expect(await render({ masteryCard: card, role: null })).not.toContain("data-test-mastery");
    const base = await render({});
    expect(base).not.toContain("data-mastery-slot");
    expect(await render({ masteryCard: null })).toBe(base);
  });
});

describe("v40: напоминания — «Мастера заведения» и «Шаг дня»", () => {
  it("prefRows: строка «master» — только если сервер прислал ключ (этап 26)", async () => {
    const { prefRows } = await import("../ui/day-cards");
    const st25 = { ok: true, pair: true, quest: true, league: true, fresh: false, month: true };
    expect(prefRows(st25).map((r) => r[0])).toEqual(["pair", "quest", "league", "fresh", "month"]);
    expect(prefRows(null).map((r) => r[0])).toEqual(["pair", "quest", "league", "fresh", "month"]);
    const rows = prefRows({ ...st25, master: false });
    expect(rows.map((r) => r[0])).toEqual(["pair", "quest", "league", "fresh", "month", "master"]);
    expect(rows[5]).toEqual(["master", "Мастера заведения", "когда коллега становится мастером роли ✦"]);
    expect(prefRows({ ...st25, master: true })).toHaveLength(6);
    const src = readFileSync("ui/day-cards.jsx", "utf8");
    expect(src).toContain("{prefRows(p).map(([k, t, sub]) => {");
  });
  it("пример сообщения: «Шаг дня: …» под текстом, перед кнопкой; без шага — как было", async () => {
    const { RemindExample } = await import("../ui/day-cards");
    const base = R(h(RemindExample, { when: "час", shift: "Вечер · 16:00–24:00" }));
    expect(base).not.toContain("Шаг дня");
    expect(base).toContain(">Через час смена: Вечер · 16:00–24:00<");
    const html = R(h(RemindExample, { when: "час", shift: "Вечер · 16:00–24:00", step: "Сыграй 3 ситуации\nу стола" }));
    const a = html.indexOf("Хорошей смены ✦<"), s = html.indexOf(">Шаг дня: Сыграй 3 ситуации у стола<"), b = html.indexOf(">Разминка ✦<");
    expect(a).toBeGreaterThan(0);
    expect(s).toBeGreaterThan(a);
    expect(b).toBeGreaterThan(s);
    expect(html).toContain('data-remind-step=""');
    expect(R(h(RemindExample, { when: "час", step: "   " }))).not.toContain("Шаг дня");
    // RemindSheet передаёт шаг в пример (сам лист — портал, на сервере не рисуется)
    const src = readFileSync("ui/day-cards.jsx", "utf8");
    expect(src).toMatch(/export function RemindSheet\(\{ a11y, uk = "", lead = false, (admin = false, )?shift = "", step = "", onClose, onChange \}\)/);   // v58: admin — подсказка про SQL только владельцу
    // строку «Шаг дня» бот добавляет только с этапом 26 — пример показывает её, когда сервер знает вид «master»
    expect(src).toContain("<RemindExample c={c} when={when} shift={shift} step={has26 ? step : \"\"} />");
    expect(src).toContain("onLoad={(p) => setHas26(!!p && p.master !== undefined)}");
  });
  it("stepLine: одной строкой, не длиннее 140 знаков с «…» — как сервер", async () => {
    const { stepLine } = await import("../ui/day-cards");
    expect(stepLine("  Раунд\tмастера \n по теме  ")).toBe("Раунд мастера по теме");
    const s140 = "я".repeat(140);
    expect(stepLine(s140)).toBe(s140);
    const long = stepLine("слово ".repeat(40));
    expect(Array.from(long).length).toBeLessThanOrEqual(140);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/ …$/);
    expect(stepLine("а".repeat(141))).toBe("а".repeat(139) + "…");
    expect(stepLine(null)).toBe("");
  });
});

describe("v40: подсказка, кнопка ассистента, контекст", () => {
  it("подсказка mastery — три шага, версия подсказок прежняя", async () => {
    const { HINTS, HINTS_VERSION, hintsFor } = await import("../data/hints");
    expect(HINTS_VERSION).toBe(5);
    expect(hintsFor("mastery")).toEqual([
      "Значки — за привычки: у каждого инструмента бронза, серебро и золото. Серые ещё не открыты — нажми, чтобы узнать, как получить.",
      "«Мастер роли ✦» — главная награда: роль пройдена, 5 золотых тем, серия 14 дней и бронза в 10 значках. Коллеги увидят знак ✦ у твоего имени.",
      "«Шаг дня» — одно дело на сегодня, подобранное под тебя. Сделал — завтра будет новое.",
    ]);
    expect(HINTS.mastery).toHaveLength(3);
  });
  it("NAV_LABELS: mastery → «Путь мастера»", () => {
    const src = readFileSync("ui/assistant.jsx", "utf8");
    const nav = src.slice(src.indexOf("const NAV_LABELS = {"), src.indexOf("};", src.indexOf("const NAV_LABELS = {")));
    expect(nav).toContain('mastery: "Путь мастера"');
  });
  it("контекст ассистента: значки, шаг дня, первые шаги и кнопка [[go:mastery|Путь мастера]] — коротко", async () => {
    const { withRefContext } = await import("../lib/reference-context");
    const profile = { restaurant: OKEAN, position: "waiter" };
    const ms = { bronze: 3, total: 14, have: 5, need: 13, master: false, step: "Сыграй «Раунд мастера» по теме «Вино»", fw: { done: 2, total: 7, active: true } };
    const c = withRefContext([{ role: "user", content: "привет" }], profile, { position: "waiter", roleTitle: "Новичок", mastery: ms })[0].content;
    expect(c).toContain("значков 3/14, до мастера роли 5/13");
    expect(c).toContain("шаг дня — Сыграй «Раунд мастера» по теме «Вино»");   // без кавычек в кавычках
    expect(c).toContain("первые шаги в академии 2/7");
    expect(c).toContain("слабые темы. Значки, мастер роли, шаг дня, первые шаги — кнопка [[go:mastery|Путь мастера]].]");
    const m = withRefContext([{ role: "user", content: "привет" }], profile, { mastery: { ...ms, master: true, step: "", fw: { done: 7, total: 7, active: false } } })[0].content;
    expect(m).toContain("значков 3/14, мастер роли ✦");
    expect(m).not.toContain("до мастера роли");
    expect(m).not.toContain("шаг дня —");
    expect(m).not.toContain("первые шаги в академии");
    expect(m).toContain("[[go:mastery|Путь мастера]]");
  });
  it("без mastery — контекст прежний; с меню и коктейлем — по-прежнему ≤ 2000 знаков", async () => {
    const { withRefContext } = await import("../lib/reference-context");
    const profile = { restaurant: OKEAN, position: "waiter" };
    const c = withRefContext([{ role: "user", content: "привет" }], profile, { position: "waiter", roleTitle: "Новичок", done: 1, total: 31 })[0].content;
    expect(c).toBe("привет\n\n[Твой собеседник — должность: waiter; трек: Новичок; пройдено 1 из 31 уроков. Отвечай под его уровень; если уместно — мягко предложи повторить слабые темы.]");
    expect(c).not.toContain("go:mastery");
    const ms = { bronze: 9, total: 14, have: 11, need: 13, master: false, step: "Освежи тему «Вино» — три задания, и бокал снова полный".repeat(4), fw: { done: 3, total: 7, active: true } };
    const big = withRefContext([{ role: "user", content: "Расскажи про негрони, том ям и как встречать гостя у входа" }], profile,
      { position: "waiter", roleTitle: "Новичок", done: 3, total: 31, dueMistakes: 4, topics: ["Вино", "Кофе"], mastery: ms })[0].content;
    expect(big.length).toBeLessThanOrEqual(2000);
    expect(big).toContain("[[go:mastery|Путь мастера]]");
    expect(big).toContain("[Данные из разделов приложения");
    expect(big).toContain("шаг дня — " + ms.step.slice(0, 90) + ";");   // длинный шаг — не больше 90 знаков
  });
});
