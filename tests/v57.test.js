// v57 (Доп. 370): «Жизнь команды» на «Команде»; звуки и вибрация в ключевые моменты; настройки в «Аккаунте».
//
// Владелец — на предложения «как сделать, чтобы было приятно заходить»: «Давай все😉»; аудит, неудобство 15:
// «в „Аккаунте“ нет настроек». Вид в браузере — tools/claude/e2e-v57.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildFeed, quizTitles, shortName, FEED_DAYS, FEED_PASS, MASTER_BANNER_DAYS } from "../lib/team-feed.js";

const rd = (f) => readFileSync(f, "utf8");
const NOW = new Date(2026, 9, 18, 14, 20).getTime();
const ago = (d, h = 12) => { const x = new Date(NOW - d * 864e5); x.setHours(h, 0, 0, 0); return x.toISOString(); };
const R = "Два моря, Океан";
const titles = { "s1-q": "Тест: мышление сервиса", "s0-q": "Тест: первый день", "bar0-q": "Тест: новичок за баром" };
const titleOf = (id) => titles[id] || "";
const me = { name: "Анна", surname: "Смирнова" };
const score = (name, surname, quiz_id, s, t, d, restaurant = R) => ({ name, surname, restaurant, quiz_id, score: s, total: t, updated_at: ago(d) });

describe("v57: лента «Жизнь команды» — тесты", () => {
  it("свои заведение и две недели; тест в ленту — от 70%; глагол по полу; название — без «Тест:», с заглавной", () => {
    expect(FEED_DAYS).toBe(14);
    expect(FEED_PASS).toBe(70);
    const f = buildFeed({ now: NOW, me, restaurant: R, titleOf, scores: [
      score("Ангелина", "Токарева", "s1-q", 11, 12, 0),
      score("Иван", "Петров", "s0-q", 9, 12, 1),
      score("Пётр", "Сидоров", "s0-q", 12, 12, 0, "Марико"),     // чужое заведение
      score("Олег", "Белов", "s0-q", 12, 12, 20),                // старше двух недель
      score("Ольга", "Ким", "s0-q", 8, 12, 0),                   // 67% — не сдан
      score("Вера", "Лис", "x-q", 12, 12, 0),                    // теста нет в программе — не показываем
    ] });
    expect(f.map((x) => x.who)).toEqual(["Ангелина Т.", "Иван П."]);
    expect(f[0]).toMatchObject({ kind: "test", text: "сдала тест «Мышление сервиса» — 92%", me: false });
    expect(f[1].text).toBe("сдал тест «Первый день» — 75%");
  });
  it("один человек и тест — одна строка (последняя); свои — «Ты»", () => {
    const f = buildFeed({ now: NOW, me, restaurant: R, titleOf, scores: [
      score("Иван", "Петров", "s0-q", 9, 12, 3), score("Иван", "Петров", "s0-q", 12, 12, 1), score("Анна", "Смирнова", "s1-q", 10, 12, 0)] });
    expect(f.length).toBe(2);
    expect(f[0]).toMatchObject({ who: "Ты", me: true, text: "сдал(а) тест «Мышление сервиса» — 83%" });
    expect(f[1].text).toBe("сдал тест «Первый день» — 100%");
  });
});

describe("v57: лента — мастера, рекорды, «спасибо»", () => {
  it("мастера: свежих чужих (7 дней) показывает баннер — в ленте их нет; старше недели и свои — есть", () => {
    expect(MASTER_BANNER_DAYS).toBe(7);
    const f = buildFeed({ now: NOW, me, masters: [
      { who: "Ангелина Токарева", role: "seasonal", at: ago(2), me: false },
      { who: "Ангелина Токарева", role: "core", at: ago(9), me: false },
      { who: "Анна Смирнова", role: "spg", at: ago(1), me: true }] });
    expect(f.map((x) => x.text)).toEqual(["стал(а) мастером роли «Хостес»", "стала мастером роли «Ядро»"]);   // v73: без ✦
    expect(f[0].who).toBe("Ты");
  });
  it("рекорды и печати — понятными словами, с падежами", () => {
    const f = buildFeed({ now: NOW, achievements: [
      { name: "Мария", surname: "Ким", key: "rush_best", value: 74, at: ago(2) },
      { name: "Иван", surname: "Петров", key: "sprint_best", value: 21, at: ago(3) },
      { name: "Мария", surname: "Ким", key: "stamps", value: 12, at: ago(4) },
      { name: "Олег", surname: "Белов", key: "streak", value: 3, at: ago(5) },
      { name: "Олег", surname: "Белов", key: "streak", value: 0, at: ago(5) }] });
    expect(f.map((x) => x.text)).toEqual(["— рекорд «Час пик»: 3 заказа за 74 с", "— рекорд «Аллергены на скорость»: 21 верный за 30 с",
      "— 12 печатей Сборки: коктейли по памяти", "— серия карточек: 3 дня подряд"]);
  });
  it("«спасибо команде» — сегодня, сверху; всё вместе — новые сверху, не больше 15", () => {
    const f = buildFeed({ now: NOW, me, restaurant: R, titleOf, thanks: [{ name: "Ольга", initial: "О", me: false }],
      scores: [score("Иван", "Петров", "s0-q", 9, 12, 1)], achievements: [{ name: "Мария", surname: "Ким", key: "rush_best", value: 74, at: ago(0, 9) }] });
    expect(f.map((x) => x.kind)).toEqual(["thanks", "record", "test"]);
    expect(f[0]).toMatchObject({ who: "Ольга", text: "— спасибо команде" });
    const many = Array.from({ length: 30 }, (_, i) => score("Имя" + i, "Ф", "s0-q", 12, 12, i % 10));
    expect(buildFeed({ now: NOW, restaurant: R, titleOf, scores: many }).length).toBe(15);
    expect(buildFeed({})).toEqual([]);
  });
  it("имя — «Анна С.»; названия тестов — из индекса программы и своих уроков", () => {
    expect(shortName("Анна", "смирнова")).toBe("Анна С.");
    expect(shortName("Анна", "")).toBe("Анна");
    const t = quizTitles({ seasonal: [{ lessons: [{ id: "s0-q", title: "Тест: первый день" }] }] }, [{ lessons: [{ id: "cms-1q", title: "Свой тест" }] }]);
    expect(t("s0-q")).toBe("Тест: первый день");
    expect(t("cms-1q")).toBe("Свой тест");
    expect(t("нет")).toBe("");
  });
});

describe("v57: «Команда» и данные ленты", () => {
  const app = rd("App.jsx"), hub = rd("ui/home-hubs.jsx");
  it("рекорды — team_achievements на вкладке «Команда», копия на телефоне; лента — из тестов, мастеров и квеста дня", () => {
    expect(app).toContain("rpc(\"team_achievements\", { p_token: saToken() }).then((res) => {");
    expect(app).toContain("localStorage.setItem(\"sa_team_ach\" + ukP, JSON.stringify(res.rows.slice(0, 200)));");
    expect(app).toContain("thanks: brief && brief.quest && Array.isArray(brief.quest.thanks) ? brief.quest.thanks : [], titleOf: feedTitleOf }) : []),");
    expect(app).toContain("<TeamFeed a11y={a11y} items={teamFeed} /></>} items={[");
  });
  it("карточка: «ЖИЗНЬ КОМАНДЫ», первые три строки, «Ещё N ›»; пусто — карточки нет", () => {
    expect(hub).toContain("export function TeamFeed({ a11y, items = [], now = Date.now(), first = 3 }) {");
    expect(hub).toContain("if (!Array.isArray(items) || !items.length) return null;");
    expect(hub).toContain("{open ? \"Свернуть\" : \"Ещё \" + (items.length - first) + \" ›\"}");
  });
});

describe("v57: звуки, вибрация, настройки", () => {
  const utils = rd("lib/utils.js"), team = rd("ui/screens-team.jsx"), app = rd("App.jsx");
  it("вибрацию можно выключить (sa_haptics) — и прямые вызовы navigator.vibrate слушаются выключателя", () => {
    expect(utils).toContain("export function hapticsOn() { try { return localStorage.getItem(HAPTICS_KEY) !== \"0\"; } catch (e) { return true; } }");
    expect(utils).toContain("    if (!hapticsOn()) return;\n    if (inTelegram()) {");
    expect(rd("ui/mood-cards.jsx")).toContain("try { hapticsOn() && navigator.vibrate && navigator.vibrate(14); } catch(e) {}");
    expect((rd("ui/screens-admin.jsx").match(/hapticsOn\(\) && navigator\.vibrate && navigator\.vibrate\(10\)/g) || []).length).toBe(2);
  });
  it("звуки: ответ в тесте и в «Работе над ошибками», печать раздела, значок и ачивка", () => {
    const L = rd("ui/screens-learning.jsx");
    expect(L).toContain("              vibrate(ok ? \"light\" : \"error\");\n              sfx(ok ? \"ok\" : \"bad\");");
    expect(L).toContain("sfx(i === q.correct ? \"ok\" : \"bad\"); };");
    expect(rd("ui/module-menu.jsx")).toContain("React.useEffect(() => { if (stampNow) { const t = setTimeout(() => { sfx(\"done\"); vibrate(\"success\"); }, 380);");
    expect(rd("ui/mastery-card.jsx")).toContain("vibrate(\"success\"); sfx(\"done\"); };");
    expect(rd("ui/screens-gamification.jsx")).toContain("    sfx(\"done\");   // v57 (Доп. 370): тихий колокольчик");
  });
  it("«Аккаунт» → «Настройки»: «Для чтения», «Звуки», «Вибрация» — переключатели (role=switch)", () => {
    expect(team).toMatch(/function AccountSettings\(\{ T, a11y, onA11y(, themeAuto = false, onThemeAuto = null)? \}\) \{/);   // v59: + тема по системе
    expect(team).toContain("role=\"switch\" aria-checked={on}");
    expect(team).toContain("{row(\"theme\", \"Для чтения\",");
    expect(team).toContain("{row(\"sound\", \"Звуки\",");
    expect(team).toContain("{row(\"haptics\", \"Вибрация\",");
    expect(team).toMatch(/<AccountSettings T=\{T\} a11y=\{a11y\} onA11y=\{onA11y\}( themeAuto=\{themeAuto\} onThemeAuto=\{onThemeAuto\})? \/>/);
    expect(app).toContain("<AccountScreen profile={profile} T={T} a11y={a11y} onA11y={setA11y}");   // v59: далее themeAuto
  });
});

describe("v57: метка и журнал", () => {
  it("метка сборки — v57; CHANGES — «Дополнение 370»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d+<\/span>/);
    expect(rd("CHANGES.md")).toContain("# Дополнение 370 — «Жизнь команды», звуки и вибрация, настройки в «Аккаунте» (v57)");
  });
});
