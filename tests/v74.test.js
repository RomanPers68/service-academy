// v74 (Доп. 387): «без примет нейросети» — тексты интерфейса и сообщения бота.
// Владелец согласовал план из трёх версий: v73 — шрифт и украшения, v74 — тексты, v75 — свои значки вместо эмодзи и ✦.
// Приметы в текстах: тире на каждом шагу («Нет связи — попробуй ещё раз»), «не X, а Y», общие мотивационные фразы
// («маленькие шаги формируют большой результат»), обрывки («Меню пока?» — нашёл владелец). Сообщения бота — без шапки
// «✦ SERVICE ACADEMY» и звёздочек (этап 29 + обновлённые этапы 22б/25/26 и две edge-функции).
// Вид — tools/claude/e2e-v74.mjs, сервер — tools/claude/sql/test29.sh.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { HINTS, HINTS_VERSION, hintsFor } from "../data/hints";
import { answerTell } from "../lib/answer-tell";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
// код без комментариев (как в v73)
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const UI = ["App.jsx", ...readdirSync("ui").filter((f) => /\.(jsx|js)$/.test(f)).map((f) => "ui/" + f), "data/hints.js"];
// «слово — слово» в коде интерфейса (тире с пробелами между словами)
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;

describe("v74: тире перестали быть ритмом", () => {
  it("во всём интерфейсе тире между словами — не больше 100 (было больше тысячи); остались связки, определения, шпаргалки SOS", () => {
    const per = Object.fromEntries(UI.map((f) => [f, dashes(rd(f))]));
    const total = Object.values(per).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100);
    // главные экраны и подсказки — почти без тире
    for (const f of ["App.jsx", "ui/screens-roleselect.jsx", "ui/home-hubs.jsx", "ui/day-cards.jsx", "ui/month-recap.jsx", "ui/league.jsx", "ui/offline.jsx"]) expect([f, per[f]]).toEqual([f, per[f] <= 1 ? per[f] : -1]);
    expect(per["data/hints.js"]).toBeLessThanOrEqual(6);
    expect(per["ui/guide.jsx"]).toBeLessThanOrEqual(10);
  });
  it("подсказки: без «не X, а Y», шаг — одна-две фразы; версия подсказок прежняя (заново не показываются)", () => {
    expect(HINTS_VERSION).toBe(5);
    const all = Object.values(HINTS).flat();
    for (const t of all) {
      expect(t, t).not.toMatch(/,\s*а не\s|\bне\s[^,.;:!?«»]{1,50},\s*а\s/);
      expect(t, t).not.toMatch(/Не чтобы/);
    }
    expect(hintsFor("mistakes")[0]).toBe("Сюда попадают вопросы, где ты ошибся. Они будут возвращаться, пока правильный ответ не запомнится.");
    expect(hintsFor("team_staff")[0]).toBe("Рейтинг считается только по тестам, стаж не важен: новичок обгоняет опытного, если учится.");
    expect(hintsFor("onboarding")[2]).toBe("Если новичок второй день стоит на месте, поговори с ним.");
    // общая фраза → конкретно, что внизу «Смены»
    expect(hintsFor("shift_staff")[1]).toBe("Ниже чек-листы смены и задание дня: три урока и глава справочника, как раз на перерыв.");
    expect(all.join(" ")).not.toContain("трек движется сам");
  });
  it("общих мотивационных фраз нет", () => {
    const src = UI.map((f) => code(rd(f))).join("\n") + code(rd("lib/now-card.js")) + code(rd("lib/mastery.js"));
    for (const s of ["маленькие шаги формируют большой результат", "учишься в моменте", "Учишься телом, не текстом", "Это только начало пути", "самое время вырваться вперёд",
      "первый шаг всё изменит", "впереди большее", "тест меряет мышление, а человека", "проверяется мышление, а не зубрёжка", "ровно когда мозг готов забыть"]) {
      expect(src, s).not.toContain(s);
    }
    // на месте «маленьких шагов» — что именно дают задания дня
    expect(rd("ui/screens-gamification.jsx")).toContain("Завтра здесь будут новые задания. Каждый урок отсюда идёт в цель дня");
  });
  it("сообщения об ошибках: «Проблема. Что сделать» вместо «Проблема — сделай»", () => {
    const src = UI.map((f) => code(rd(f))).join("\n") + ["lib/talk.js", "lib/voice.js", "lib/server-text.js", "lib/live-guest.js"].map((f) => code(rd(f))).join("\n");
    expect(src).not.toMatch(/ — (попробуй|перезайди|скажи владельцу|скажи руководителю|проверь связь|коснись волны)/);
    expect(src).toContain('"Нет связи. Попробуй ещё раз."');
    expect(src).toContain('"Сессия устарела. Перезайди по коду."');
  });
});

describe("v74: главная, «Я», приветствие", () => {
  it("приветствие: четыре карточки, которые видно, — без тире-ритма; невидимых карточек больше нет", () => {
    const app = rd("App.jsx");
    expect(app).toContain('text: "«Учусь»: уроки и тесты твоей роли. «Смена»: рабочий день, график и чек-листы. «Команда»: коллеги и рейтинг. «Я»: твой прогресс и настройки." };');
    expect(app).toContain("Большая карточка на главной ведёт к следующему шагу: сначала «Начать», потом «Дальше». В тестах верный ответ подсвечивается сразу.");
    expect(app).toContain("Круглая кнопка «AI» посередине нижнего меню (на компьютере в меню слева) открывает Наставника.");
    expect(app).toContain("WELCOME_TABS_CARD,");
    for (const gone of ["WELCOME_BUILD_CARD", "WELCOME_SCHEDIT_CARD", "WELCOME_PAPER_CARD", "WELCOME_MORE_CARDS", "Тренажёры — твой спортзал", "Твой штаб — «Команда»"]) expect(app, gone).not.toContain(gone);
  });
  it("экзамен ступени — без «слепого» теста (после ответа видно верный вариант): 10 вопросов, 80%", () => {
    expect(rd("App.jsx")).toContain('sub: "10 вопросов из тестов роли, для сдачи нужно 80%. За сданный экзамен получишь сертификат и печать в Книге.",');
    expect(rd("App.jsx")).not.toContain("«Слепой»");
    expect(rd("ui/guide.jsx")).not.toContain("«слепой»");
    expect(rd("ui/screens-exam.jsx")).toContain("const EXAM_COUNT = 10;");
    expect(rd("ui/screens-exam.jsx")).toContain("const EXAM_PASS = 0.8;");
  });
  it("«Я» и «Смена»: подписи пунктов — фразами", () => {
    const app = rd("App.jsx");
    expect(app).toContain('sub:"Что сделано за 7 дней. Можно отправить команде"');
    expect(app).toContain('sub: tgRemind ? "Включено: за час до смены зовёт на разминку" : "Разминка в 2 минуты за час до смены"');
    expect(app).toContain('sub:"Что пройдено, где ошибаюсь, что повторить (PDF)"');
  });
  it("лента «Жизнь команды»: «Аня К. поставила рекорд…» — глаголом, без «Аня К. — рекорд»", async () => {
    const { buildFeed } = await import("../lib/team-feed.js");
    const now = Date.parse("2026-10-20T12:00:00Z"), at = new Date(now - 3600e3).toISOString();
    const f = buildFeed({ now, me: { name: "Иван", surname: "Петров" }, achievements: [{ key: "rush_best", value: 80, name: "Анна", surname: "Смирнова", at },
      { key: "sprint_best", value: 22, name: "Иван", surname: "Петров", at }], thanks: [{ name: "Олег" }] });
    expect(f.map((x) => x.who + " " + x.text)).toEqual(["Олег сказал спасибо команде", "Анна С. поставила рекорд «Час пик»: 3 заказа за 80 с",
      "Ты поставил(а) рекорд «Аллергены на скорость»: 22 верных за 30 с"]);
  });
});

describe("v74: «Напоминания в Telegram» (скриншоты владельца)", () => {
  it("пример сообщения — как новое сообщение бота: без шапки «✦ SERVICE ACADEMY» и звёздочек, кнопка «Разминка»", async () => {
    const { RemindExample } = await import("../ui/day-cards");
    const html = R(h(RemindExample, { when: "час", shift: "День · 11:00–24:00", step: "послушай «Радио в дорогу»" }));
    expect(html).not.toContain("SERVICE ACADEMY");
    expect(html).not.toContain("✦");
    expect(html).toContain(">Через час смена: День · 11:00–24:00<");
    expect(html).toContain(">Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!<");
    expect(html).toContain(">Шаг дня: послушай «Радио в дорогу»<");
    expect(html).toContain(">Разминка</div>");
  });
  it("служебная пометка «/* v58 (Доп. 371) */» больше не видна на экране: комментарий — в фигурных скобках", () => {
    const src = rd("ui/day-cards.jsx");
    expect(src).not.toContain(": null}   /* v58 (Доп. 371) */");
    expect(src).toContain('sql: "supabase-stage22b-telegram-reminders.sql" })) : null}{/* v58 (Доп. 371);');
    // во всех экранах: «}   /* …» в конце JSX-выражения перед переносом — признак такого же голого комментария
    for (const f of UI.filter((x) => x.endsWith(".jsx"))) expect([f, /\) : null\}\s+\/\*[^*]*\*\/\s*$/m.test(rd(f))]).toEqual([f, false]);
  });
  it("окно напоминаний: подписи без тире", () => {
    const src = rd("ui/day-cards.jsx");
    expect(src).toContain("✓ Включено: за {when} до смены</div>");
    expect(src).toContain('["league", "Лига недели", "итоги недели по понедельникам"],');
    expect(src).toContain('["pair", "Свеча на двоих", "вечером, если напарник уже занимался, а ты ещё нет"],');
    expect(src).toContain("бот пришлёт сообщение с кнопкой разминки: 2 минуты, 3 задания из пройденного.");
  });
  it("«Мастера заведения»: без «Первый знак ✦» (скриншот владельца); знак мастера — словами до своего значка в v75", () => {
    expect(rd("ui/mastery.jsx")).toContain(">Пока никого. Первым мастером в заведении можешь стать ты</div>");
    expect(rd("ui/mastery.jsx")).not.toContain("Первый знак");
    expect(hintsFor("mastery")[1]).toContain("Коллеги увидят знак мастера у твоего имени.");
    expect(rd("ui/guide.jsx")).toContain("знак мастера у имени в рейтинге и лиге");
  });
});

describe("v74: «Меню пока?» → «Принести пока меню?» (нашёл владелец)", () => {
  it("гостья Ольга, «Первые секунды»: реплика целиком, верный вариант не выдаёт себя длиной", async () => {
    const { DIALOGUES_DATA } = await import("../data/dialogues.js");
    const d = DIALOGUES_DATA.find((x) => x.id === "spg-b1-1");
    const step = d.steps.find((s) => s.type === "choice" && s.prompt === "Гостья расположилась. Финальный штрих?");
    const ok = step.options.find((o) => o.correct);
    expect(ok.text).toBe("Тёплая улыбка и взгляд: «Как подруга придёт, провожу её к вам. Принести пока меню?»");
    expect(answerTell(step.options)).toBe(false);
    expect(rd("data/dialogues.js")).not.toContain("Меню пока?");
  });
});

describe("v74: сообщения бота — без шапки и звёздочек (этап 29)", () => {
  const s29 = rd("supabase/supabase-stage29-bot-texts.sql");
  const bodies = [...s29.matchAll(/execute \$fn\$([\s\S]*?)\$fn\$;/g)].map((m) => m[1]);
  it("этап 29: семь функций бота (напоминание — в двух видах), в телах нет ✦ и «SERVICE ACADEMY»; каждая — только если есть", () => {
    expect(bodies.length).toBe(8);
    for (const b of bodies) { expect(b).not.toContain("✦"); expect(b).not.toContain("SERVICE ACADEMY"); }
    for (const sig of ["public.tg_link(text,text,boolean)", "public._sa_warmup_due(boolean)", "public._sa_skill_req_notify()", "public.quest_call(text)", "public.pair_nudge(text)",
      "public._sa_nudges_at(boolean,timestamp with time zone)", "public.mastery_claim(text,text,integer,integer)"]) expect(s29).toContain("if to_regprocedure('" + sig + "') is null then");
    expect(s29).toContain("prosrc like '%Шаг дня%'");
    expect(s29).toContain("notify pgrst, 'reload schema';");
    expect(s29).toContain("as \"проверка этапа 29\"");
    expect(bodies.join("\n")).toContain("E'\\n\\nРазминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!'");
  });
  it("этапы 22б, 25 и 26 — с теми же текстами: перезапуск не вернёт звёздочки", () => {
    for (const f of ["supabase/supabase-stage22b-telegram-reminders.sql", "supabase/supabase-stage25-live.sql", "supabase/supabase-stage26-mastery.sql"]) {
      const c = rd(f).split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
      expect([f, c.includes("SERVICE ACADEMY"), /sa_tg_send\([^;]*✦/.test(c)]).toEqual([f, false, false]);
    }
  });
  it("edge-функции «Вопрос дня» и «Завтра смена»: без шапки, звёздочек и значков в конце вопросов", () => {
    const d = rd("supabase/functions/daily-reminder/index.ts"), s = rd("supabase/functions/shift-reminder/index.ts");
    for (const x of [d, s]) { expect(x).not.toContain("✦"); expect(x).not.toContain("SERVICE ACADEMY"); }
    expect(d).toContain("const text = `Вопрос дня:\\n${q}\\n\\nПроверь себя за 2 минуты.`;");
    expect(d).toContain('text: "Открыть академию"');
    expect(d).not.toMatch(/\? [\u{1F300}-\u{1FAFF}☀-➿]/u);
    expect(s).toContain('let text = "Завтра смена: " + sh.name + " · " + when;');
    expect(s).toContain('text += "\\n\\nПовтори, что подзабыл, и хорошей смены!";');
    expect(s).toContain('text: "Открыть график"');
  });
  it("README Supabase — этап 29 и повторный деплой двух функций", () => {
    const r = rd("supabase/README.md");
    expect(r).toContain("| 38 | `supabase-stage29-bot-texts.sql` |");
    expect(r).toContain("### Этап 29 (v74)");
    expect(r).toContain("`supabase functions deploy shift-reminder`");
  });
});

describe("v74: метка и журнал", () => {
  it("«сборка v74», «Дополнение 387»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(7[4-9]|[89]\d|\d{3,})<\/span>/);   // v74 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 387 — тексты без примет нейросети: меньше тире, без «не X, а Y» и общих фраз; бот без шапки и звёздочек (v74)");
  });
});
