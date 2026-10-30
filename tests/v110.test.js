// v110 (Доп. 423): порядок и минимализм. Владелец (30.10) после разбора новых экранов взял все четыре блока («Утро и Новички»,
// «Первая неделя», «Спасибо от коллег», «Что дало обучение») и попросил вкладки «Смена», «Команда», «Я» одним видом: все группы
// строками в одной карточке, как «Управление». Плюс мелочи: черта над первой строкой «Ты вывела на самостоятельную смену»,
// заголовок вплотную к «Добавить новичка», две «Написать» у новичка.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { deltaText, gainHeadline, learnRows, hallRows, gainModel } from "../lib/gain.js";
import { casesSub } from "../lib/cases.js";
import { guestSub } from "../lib/guest-lite.js";

const rd = (f) => readFileSync(f, "utf8");
const R = (el) => renderToString(el);
const h = React.createElement;
const noop = () => {};
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;

describe("v110: «Что дало обучение» — главное одной строкой и разница цифрой", () => {
  const OCT = { ok: true, month: "2026-10", team: 9, learn: { people: 8, lessons: 74, tests: 47, days: 40 }, plearn: { people: 6, lessons: 30, tests: 19, days: 22 },
    quiz: { n: 100, wrong: 7 }, pquiz: { n: 100, wrong: 14 }, thanks: { n: 42, prev: 22 }, peer: { n: 5, prev: 2 }, newbies: { n: 1, days: 6, pn: 1, pdays: 11 }, grew: [], idle: [] };
  it("разница: «+44», «−7%», «−5 дней»; столько же или сравнить не с чем — пусто", () => {
    expect(learnRows(OCT).map(deltaText)).toEqual(["+44", "+28", "+2"]);
    expect(hallRows(OCT).map(deltaText)).toEqual(["+20", "−7%", "−5 дней", "+3"]);
    expect(deltaText({ now: 3, was: 3 })).toBe("");
    expect(learnRows({ ...OCT, plearn: null }).map(deltaText)).toEqual(["", "", ""]);
    expect(hallRows({ ...OCT, newbies: { n: 1, days: 1, pn: 0, pdays: 0 } }).map(deltaText)[2]).toBe("");
    expect(deltaText({ now: 1, was: 3, unit: "d" })).toBe("−2 дня");
  });
  it("главное: «Команда прошла 74 урока и 47 тестов», «В зале лучше по всем четырём строкам»; хуже — так и пишем", () => {
    expect(gainHeadline(OCT)).toEqual({ learn: "Команда прошла 74 урока и 47 тестов", hall: "В зале лучше по всем четырём строкам", tone: "good" });
    expect(gainHeadline({ ...OCT, thanks: { n: 10, prev: 22 } })).toMatchObject({ hall: "В зале лучше по 3 из 4, хуже по 1", tone: "mixed" });
    expect(gainHeadline({ ...OCT, thanks: { n: 10, prev: 22 }, quiz: null, newbies: null, peer: null })).toMatchObject({ hall: "В зале стало хуже", tone: "bad" });
    expect(gainHeadline({ ...OCT, quiz: null, newbies: null })).toMatchObject({ hall: "В зале лучше по всем двум строкам", tone: "good" });
    expect(gainHeadline({ ...OCT, learn: { people: 0, lessons: 0, tests: 0, days: 0 }, thanks: null, quiz: null, newbies: null, peer: null })).toEqual({ learn: "", hall: "", tone: "" });
    expect(gainHeadline({ ...OCT, learn: { people: 1, lessons: 1, tests: 0, days: 1 } }).learn).toBe("Команда прошла 1 урок");
    expect(gainHeadline(gainModel({ ...OCT, plearn: null, thanks: { n: 3, prev: 0 }, quiz: null, newbies: null, peer: null })).hall).toBe("В зале стало лучше");
  });
  it("экран: главное над «Чему учились», разница у каждой строки, кружки с инициалами у «выросли» и «не занимались»", () => {
    const src = rd("ui/gain.jsx");
    expect(src).toContain("const hd = m ? gainHeadline(m) : { learn: \"\", hall: \"\", tone: \"\" };");
    expect(src.indexOf("data-gain-head=")).toBeGreaterThan(src.indexOf("data-gain-period="));
    expect(src.indexOf("data-gain-head=")).toBeLessThan(src.indexOf('h("Чему учились"'));
    expect(src).toContain('vsub: delta(x, { "data-gain-delta": x.key })');
    expect(src).toContain('ava: g.n, attrs: { "data-gain-grew": g.id }');
    expect(src).toContain('ava: x.n, attrs: { "data-gain-idle": x.id }');
    expect(dashes(src)).toBe(0);
  });
});

describe("v110: «Утро руководителя» — значки по смыслу, даты одинаково", () => {
  it("значки: смена днём солнце, вечером луна; брифинг, стоп-лист, «спасибо», прочитали, занятия, чек-листы, люди — свои", () => {
    const src = rd("ui/morning.jsx");
    expect(src).toContain('import { GlyphMark } from "./glyphs";');
    expect(src).not.toContain("const Mark = ");
    for (const ic of ["sun", "moon", "clock", "userPlus", "swap", "brief", "stop", "heart", "eye", "book", "checklist", "person", "team", "plane", "server", "calendar"])
      expect(src.includes('"' + ic + '"')).toBe(true);
    expect(src).toContain('const shiftIcon = (from) => (from >= 15 || from < 5 ? "moon" : "sun");');
    // «На неделе»: сверху что случилось, под ним день — как у заявок
    expect(src).toContain('row("hole-" + d, "warn", "Не хватает " + holesText(b, d), { first: i === 0, icon: "userPlus", sub: upFirst(dLong(d)),');
    expect(src).not.toContain('dShort(d) + ": не хватает "');
    expect(dashes(src)).toBe(0);
  });
  it("значок: кружок со значком; «!» и галочка — отметкой на кружке; неизвестный значок — точка", async () => {
    const { GlyphMark, GLYPH } = await import("../ui/glyphs.jsx");
    const c = { ok: "#0f0", warn: "#fa0", gold: "#c90", chip: "transparent" };
    const a = R(h(GlyphMark, { icon: "sun", kind: "info", c })), b = R(h(GlyphMark, { icon: "brief", kind: "warn", c })), k = R(h(GlyphMark, { icon: "checklist", kind: "ok", c }));
    expect(a).toContain('data-glyph="sun"'); expect(a).toContain('data-glyph-kind="info"'); expect((a.match(/<svg/g) || []).length).toBe(1);
    expect(b).toContain('data-glyph-kind="warn"'); expect((b.match(/<svg/g) || []).length).toBe(2); expect(b).toContain("M12 5v9M12 19.5v.5");
    expect(k).toContain("M5 12.5l4.2 4.2L19 7");
    expect(R(h(GlyphMark, { icon: "nope", kind: "info", c }))).toContain("border-radius:50%;background:#c90");
    expect(Object.keys(GLYPH).length).toBeGreaterThanOrEqual(16);
  });
});

describe("v110: «Новички» и «Первая неделя»", () => {
  it("список: сначала новички, памятка внизу коротко; карточка — подробности на всю ширину, темы плашками «45 из 100», «План недели»", () => {
    const src = rd("ui/newbie.jsx");
    const list = src.indexOf('{h(lead ? "Новички" : "Ты наставник"'), memo = src.indexOf("{lead ? memoCard() : null}"), led = src.indexOf('"вывела" : "вывел") + " на самостоятельную смену"');
    expect(list).toBeGreaterThan(0); expect(led).toBeGreaterThan(list); expect(memo).toBeGreaterThan(led);
    expect(src).toContain('{"Приходить " + (m.arrive ? "за " + m.arrive + " минут до смены" : "к началу смены")}');
    expect(src).toContain('f.topic.replace(/^Свой раздел:\\s*/, "").toLowerCase() + (f.score != null ? " " + f.score + " из 100" : "")');
    expect(src).toContain('<span style={{ fontSize: 12, color: sub }}>План недели</span>');
    // черта — не над первой строкой «Ты вывела…»; отступ под «Добавить новичка»
    expect(src).toContain('line("led" + i, "", nm(x.name) + (x.solo ? ", " + dayMon(x.solo) : ""), null, i > 0)');
    expect(src).toContain('borderTop: top ? "1px solid " + c.line : 0');
    expect(src).toContain('data-nbl-add="" onClick');
    expect(src).toMatch(/padding: "10px 12px", marginBottom: 16 \}\} (data-lens-btn="main" )?data-nbl-add=""/);   // v111: линза — data-lens-btn
  });
  it("листы «Наставник» и «Добавить новичка»: поиск по имени от шести человек; строки без человека видны всегда", async () => {
    const { pickFilter, NB_SEARCH_FROM } = await import("../ui/newbie.jsx");
    expect(NB_SEARCH_FROM).toBe(6);
    const rows = [{ key: "a", name: "Анна Смирнова", title: "Анна Смирнова" }, { key: "v", name: "Вера Соколова", title: "Вера Соколова" }, { key: "p", name: "Пётр Орлов", title: "Пётр Орлов" },
      { key: "", title: "Без наставника" }];
    expect(pickFilter(rows, "").length).toBe(4);
    expect(pickFilter(rows, "ве").map((r) => r.key)).toEqual(["v", ""]);
    expect(pickFilter(rows, "петр").map((r) => r.key)).toEqual(["p", ""]);   // ё и е — одно
    expect(pickFilter(rows, "ОРЛ").map((r) => r.key)).toEqual(["p", ""]);
    const src = rd("ui/newbie.jsx");
    expect(src).toContain('placeholder="Найти по имени" aria-label="Найти по имени"');
    expect(src).toContain('{q ? "Никого с таким именем." : "Пока некого выбрать."}');
  });
  it("«Первая неделя»: шаги строками в одной карточке на раздел, пустой кружок — золотым ободком, раздел «сейчас»; одна «Написать»", async () => {
    const { nowSection } = await import("../ui/newbie.jsx");
    const plan = (keys, done = 0, total = 12) => ({ sections: keys.map((key) => ({ key, steps: [] })), done, total });
    const nb = (day, first) => ({ day, first: first ? { day: first } : null });
    expect(nowSection(nb("2026-10-29", "2026-10-30"), plan(["focus", "d1", "d2", "d3"]))).toBe("focus");   // до первой смены — темы с собеседования
    expect(nowSection(nb("2026-10-29", "2026-10-30"), plan(["d1", "d2", "d3"]))).toBe("d1");
    expect(nowSection(nb("2026-10-30", "2026-10-30"), plan(["focus", "d1", "d2", "d3"]))).toBe("d1");     // первая смена сегодня
    expect(nowSection(nb("2026-10-31", "2026-10-30"), plan(["d1", "d2", "d3"]))).toBe("d2");
    expect(nowSection(nb("2026-11-01", "2026-10-30"), plan(["d1", "d2", "d3"]))).toBe("d2");
    expect(nowSection(nb("2026-11-02", "2026-10-30"), plan(["d1", "d2", "d3"]))).toBe("d3");
    expect(nowSection(nb("2026-10-30", null), plan(["focus", "d1"]))).toBe("focus");
    expect(nowSection(nb("2026-10-30", "2026-10-30"), plan(["d1", "d2", "d3"], 12, 12))).toBe("");        // всё сделано
    const src = rd("ui/newbie.jsx");
    const week = src.slice(src.indexOf("export function NewbieScreen"), src.indexOf("function MemoSheet"));
    expect((week.match(/data-nb-dm=/g) || []).length).toBe(1);
    expect(week).toContain('data-nb-sec={sec.key} data-nb-now={now ? "1" : "0"}');
    expect(week).toContain('borderTop: i ? "1px solid " + c.line : 0');
    expect(week).not.toContain("...T.modCard, display: \"flex\", alignItems: \"center\", gap: 12, padding: \"11px 14px\", marginBottom: 8");
    expect(src).toContain('border: on ? "none" : "2px solid " + c.ring');
    expect(dashes(src)).toBe(0);
  });
});

describe("v110: «Спасибо от коллег»", () => {
  it("свой значок в «Я»; крупно неделя и очки, месяц и всего мельче; пока «спасибо» нет — без нулей; кружок с инициалами", () => {
    const hubs = rd("ui/home-hubs.jsx"), app = rd("App.jsx"), src = rd("ui/peer-thanks.jsx");
    expect(hubs).toMatch(/\n {2}peer: \(c\) => <svg /);
    expect(app).toContain('peerInfo && { key:"peer", group:"Мой путь", icon:"peer", label:"Спасибо от коллег"');
    expect(src).toContain('{Number(st.week) > 0 ? "+" + Number(st.week) * 5 + " очков в «Сотруднике недели»" : "Каждое «спасибо» даёт 5 очков в «Сотруднике недели»"}');
    expect(src).toContain('{"За месяц " + (st.month || 0) + " · всего " + (st.total || 0)}');
    expect(src).toContain("{Number(st.total) > 0 ? (");
    expect(src).not.toContain("Коллеги говорят спасибо карточкой в «Вся команда». Каждое");
    expect(src).toContain("<Ava name={x.name} />");
    expect(dashes(src)).toBe(0);
  });
  it("лист «Спасибо коллеге»: сноска в одну строку", () => {
    const chat = rd("ui/chat.jsx");
    expect(chat).toContain('<div className="ch-hint" data-chat-thx-hint="">Карточку увидит вся команда, коллеге +5 очков.</div>');
    expect(chat).not.toContain("У коллеги она останется в «Я»");
  });
});

describe("v110: вкладки одним видом", () => {
  const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" } };
  const it_ = (key, group, extra = {}) => ({ key, group, icon: "book", label: "Пункт " + key, sub: "подпись " + key, onClick: noop, ...extra });
  it("compactGroups={true}: каждая группа — строками в одной карточке, значки без плашки, счётчики справа", async () => {
    const { HubScreen } = await import("../ui/home-hubs");
    const html = R(h(HubScreen, { T, a11y: false, title: "Смена", compactGroups: true,
      items: [it_("a", "На смене"), it_("b", "На смене", { badge: "3" }), it_("c", "Потренироваться", { badge: "новое" }), it_("d", "Потренироваться")] }));
    expect((html.match(/data-hub-compact/g) || []).length).toBe(2);
    expect([...html.matchAll(/data-hub-group="([^"]+)"/g)].map((m) => m[1])).toEqual(["На смене", "Потренироваться"]);
    expect((html.match(/data-hub-ic=""/g) || []).length).toBe(4);
    expect(html).toContain(">3</span>"); expect(html).toContain(">новое</span>");
    // массив — как раньше: строками только перечисленные
    const html2 = R(h(HubScreen, { T, a11y: false, title: "Я", compactGroups: ["Итоги"], items: [it_("a", "Мой путь"), it_("w", "Итоги")] }));
    expect((html2.match(/data-hub-compact/g) || []).length).toBe(1);
  });
  it("fold: группы — кнопками (свёрнуты: разделы одной строкой, счётчик на значке); открытые — строками; одна в группе — сам раздел", async () => {
    const { HubScreen, groupPreview, groupBadge, GROUP_ICON } = await import("../ui/home-hubs");
    const items = [it_("a", "На смене"), it_("b", "На смене", { badge: "3" }), it_("c", "Потренироваться", { badge: "новое" }), it_("d", "Потренироваться"), it_("e", "Вместе")];
    const html = R(h(HubScreen, { T, a11y: false, title: "Смена", compactGroups: true, fold: true, hubId: "shift", items }));
    expect([...html.matchAll(/data-hub-toggle="([^"]+)"/g)].map((m) => m[1])).toEqual(["На смене", "Потренироваться"]);
    expect((html.match(/aria-expanded="false"/g) || []).length).toBe(2);
    expect(html).not.toContain("data-hub-compact");
    expect(html).toMatch(/data-hub-preview=""[^>]*>Пункт a · Пункт b<\/span>/);
    expect(html).toContain('data-hub-badge="3"'); expect(html).toContain('data-hub-badge="новое"');
    expect(html).toContain('aria-label="На смене, новых: 3"'); expect(html).toContain('aria-label="Потренироваться, есть новое"');
    expect(html).toMatch(/data-hub-group="Вместе" data-hub-single=""/);
    expect(html).toContain('aria-label="Пункт e"');
    expect(groupPreview(items.slice(0, 2))).toBe("Пункт a · Пункт b");
    expect(groupBadge([it_("x", "g"), it_("y", "g", { badge: "новое" }), it_("z", "g", { badge: "12" })])).toEqual({ text: "12", red: false });
    expect(groupBadge([it_("x", "g", { badge: "новые" })])).toEqual({ text: "новое", red: false });
    expect(groupBadge([it_("x", "g")])).toBe(null);
    for (const g of ["На смене", "Потренироваться", "Управление", "Команда", "Мой путь", "Итоги и документы", "Помощь и настройки"]) expect(typeof GROUP_ICON[g]).toBe("string");
    // открыто (как помнит телефон) — строками в карточке группы, без счётчика на кнопке
    const was = globalThis.localStorage;
    globalThis.localStorage = { getItem: (k) => (k === "sa_hub_open" ? JSON.stringify({ shift: ["На смене"] }) : null), setItem: () => {} };
    try {
      const open = R(h(HubScreen, { T, a11y: false, title: "Смена", compactGroups: true, fold: true, hubId: "shift", items }));
      expect(open).toMatch(/data-hub-group="На смене" data-hub-open="1"/);
      expect(open).toMatch(/data-hub-group="Потренироваться" data-hub-open="0"/);
      expect((open.match(/data-hub-compact/g) || []).length).toBe(1);
      expect(open).not.toContain('data-hub-badge="3"');
      globalThis.localStorage = { getItem: () => "all", setItem: () => {} };
      const all = R(h(HubScreen, { T, a11y: false, title: "Смена", compactGroups: true, fold: true, hubId: "shift", items }));
      expect((all.match(/aria-expanded="true"/g) || []).length).toBe(2);
    } finally { globalThis.localStorage = was; }
    const css = rd("ui/css.js");
    expect(css).toContain("@keyframes saHubOpen");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .sa-hubrows { animation: none; } .sa-hubchev { transition: none; } }");
  });
  it("App: «Смена», «Команда», «Я» — группы кнопками, внутри строками; подписи короче (в строке — одна строка)", () => {
    const app = rd("App.jsx");
    expect((app.match(/compactGroups=\{true\}/g) || []).length).toBe(3);
    for (const id of ["shift", "team", "me"]) expect(app).toContain('compactGroups={true} fold hubId="' + id + '"');
    for (const s of ['label:"Утро руководителя", sub:"Сводка дня и каждое утро в Telegram"', 'label:"Опаздываю", sub:"Предупредить руководителя и команду"',
      '"Пять минут перед сменой: график и фокус"', 'label:"Чат смены", sub: "Команда, старшие и личные сообщения"', 'label:"Радио в дорогу", sub:"Три коротких выпуска из твоих уроков"',
      'sub:"Подписка: смены обновляются сами"', 'label:"Чек недели", sub:"Что сделано за 7 дней"', 'label:"Мой отчёт", sub:"Что пройдено и что повторить, PDF"',
      'sub: leagueSub(brief) || "Очки за занятия с понедельника"', '" значков, до мастера " + mShown.master.have']) expect(app).toContain(s);
    expect(casesSub(null, false)).toBe("Расскажи свой, команда потренируется");
    expect(guestSub("seasonal", "waiter")).toBe("Гость-ИИ из твоего меню · чек разбора");
    expect(guestSub("spg")).toBe("Гость-ИИ у входа · чек разбора");
  });
  it("новичку в «Смене» — «Первая неделя» карточкой с прогрессом (не группой с одним пунктом)", async () => {
    const app = rd("App.jsx");
    expect(app).toContain('{nbOn && nbInfo.newbie ? <NewbieHero a11y={a11y} done={nbDoneCount(nbInfo)} total={nbTotalCount(nbInfo)} onOpen={() => navigate("newbie")}');
    expect(app).not.toContain('nbOn && nbInfo.newbie && { key:"ob", group:"Первая неделя"');
    const { NewbieHero } = await import("../ui/home-hubs");
    const html = R(h(NewbieHero, { a11y: false, line: "Первая смена: сегодня, 12:00", done: 1, total: 12, onOpen: noop }));
    expect(html).toContain('aria-label="Первая неделя"'); expect(html).toContain("сделано <!-- -->1<!-- --> из <!-- -->12");
    expect(html).toContain("Первая смена: сегодня, 12:00"); expect(html).toContain("width:8%");
    expect(R(h(NewbieHero, { a11y: true, line: "План по дням и темы с собеседования", done: 0, total: 0 }))).not.toContain("сделано");
  });
  it("всё новое — без тире между словами и без эмодзи", () => {
    for (const f of ["ui/glyphs.jsx", "ui/home-hubs.jsx", "ui/peer-thanks.jsx", "ui/newbie.jsx", "ui/morning.jsx", "ui/gain.jsx"]) {
      expect(dashes(rd(f))).toBe(0);
      expect(/[\u{1F300}-\u{1FAFF}]/u.test(rd(f))).toBe(false);
    }
  });
});
