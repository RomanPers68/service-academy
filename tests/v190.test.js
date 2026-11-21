// v190 (Доп. 515): «назад» возвращает туда, откуда пришли.
// Владелец: «Столкнулся с тем, что приложение забывает откуда зашло в ту или иную вкладку. Нажимая назад он возвращает
// не туда, откуда зашел».
//   • App.jsx — экраны «Чек-лист», «Адаптация», «Аналитика», «Редактор», «Статистика», «Тренировка дня», «Словарь»,
//     «Рейтинг», «Карта обучения», «Карточка игрока», тема программы, «Кандидат» уходят назад по истории (goBack), а не
//     на заранее заданный экран; тема программы открывается с записью в историю (navigate("module"));
//   • сертификат → назад к списку сертификатов, а не снова на экзамен (backTo);
//   • открыли экран из карточки в чате — «назад» снова открывает тот же чат (item.from, chatBackRef, chatReturn);
//   • Наставник и чат открывают уроки, блюда, коктейли одинаково — с записью в историю (assistantNavigate(dest)).
// В браузере: tools/claude/e2e-v190.mjs (TABS, DEEP, EXAM, CHAT, ARROW).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const APP = rd("App.jsx");
const line = (re) => APP.split("\n").find((l) => re.test(l)) || "";

describe("v190 · версия и журнал", () => {
  it("сборка v190, Дополнение 515, слова владельца, сценарий", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(190);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 515 — .*\(v190\)/);
    const part = c.slice(c.indexOf("# Дополнение 515")).replace(/\s+/g, " ");
    expect(part).toContain("Столкнулся с тем, что приложение забывает откуда зашло в ту или иную вкладку");
    for (const l of c.slice(c.indexOf("# Дополнение 515")).split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v190.mjs");
  });
});

describe("v190 · экраны уходят назад по истории", () => {
  const screens = { checklist: "roleSelect", onboarding: "roleSelect", analytics: "roleSelect", glossary: "roleSelect", leaderboard: "roleSelect",
    daily: "roleSelect", stats: "roleSelect", playerDetail: "stats", trainingCard: "profile" };
  for (const [s, fb] of Object.entries(screens)) {
    it(`${s}: назад — goBack("${fb}"), без жёсткого перехода`, () => {
      const l = line(new RegExp(`\\{screen === "${s}"`));
      expect(l, s).toContain(`goBack("${fb}")`);
      expect(l, s).not.toMatch(/onBack=\{\(\) => navigate\(/);
    });
  }
  it("редактор контента: свои уроки перечитываются и назад по истории", () => {
    expect(line(/\{screen === "contentEditor"/)).toContain('onBack={() => { loadCustomLessons(); goBack("roleSelect"); }}');
  });
  it("кандидат: назад по истории (руководителю запасной — «Команда»)", () => {
    expect(line(/\{screen === "candidate"/)).toContain('goBack(profile?.is_admin ? "team" : "roleSelect")');
  });
  it("тема программы открывается с записью в историю", () => {
    const fn = APP.slice(APP.indexOf("const openModule"), APP.indexOf("const openModule") + 1500);
    expect(code(fn)).toContain('navigate("module");');
    expect(code(fn)).not.toContain('setScreen("module")');
  });
});

describe("v190 · сертификаты и экзамен", () => {
  it("сертификат → назад к списку (backTo), экзамен → назад по истории, список → назад по истории", () => {
    expect(line(/\{screen === "certificate" &&/)).toContain('onExit={() => backTo("certificates")}');
    expect(line(/\{screen === "exam" &&/)).toContain('onExit={() => goBack("certificates")}');
    expect(line(/\{screen === "certificates" &&/)).toContain('onExit={() => goBack("roleSelect")}');
  });
  it("backTo обрезает историю до экрана и ничего не дописывает", () => {
    const fn = code(APP.slice(APP.indexOf("const backTo = useCallback"), APP.indexOf("const backTo = useCallback") + 600));
    expect(fn).toContain("st.lastIndexOf(target)");
    expect(fn).toContain("commitStack(st.slice(0, i))");
    expect(fn).toContain("setScreen(target)");
    expect(fn).not.toContain("navigate(");
  });
});

describe("v190 · назад в чат, откуда открыли", () => {
  it("чат передаёт, из какой переписки открыли карточку", () => {
    expect(rd("ui/chat.jsx")).toContain("app.open(extra && typeof extra === \"object\" ? { ...extra, from: chat.id } : extra)");
  });
  it("отметка «назад в чат» ставится после перехода и снимается вкладкой", () => {
    expect(APP).toContain("const mark = () => { if (from != null) chatBackRef.current = { id: from, depth: navRef.current.length }; };");
    for (const k of ['navigate("schedule"); mark();', 'navigate("reference"); mark();', 'navigate("wines"); mark();',
      "assistantNavigate({ dish: id }); mark();", "assistantNavigate({ cocktail: id }); mark();", "openModule(m); mark();"]) expect(APP, k).toContain(k);
    expect(APP).toContain("if (TAB_SCREENS.includes(to)) { commitStack([]); chatBackRef.current = null; }");
  });
  it("урок из чата: отметка ждёт, пока трек загрузится и урок откроется (не дольше 15 с)", () => {
    expect(APP).toContain("chatLessonMark.current = { mark, at: Date.now() }; assistantNavigate({ lesson: id });");
    expect(APP).toContain("if (lm && Date.now() - lm.at < 15000) lm.mark();");
  });
  it("назад ниже отметки — чат открывается снова, отметка одна на раз", () => {
    const fn = code(APP.slice(APP.indexOf("const chatReturn"), APP.indexOf("const chatReturn") + 300));
    expect(fn).toContain("len < cb.depth");
    expect(fn).toContain("chatBackRef.current = null");
    expect(fn).toContain("reopenChatRef.current(cb.id)");
    expect(APP).toContain("reopenChatRef.current = (id) => setChatOpen(id != null ? { id } : true);");
    const gb = code(APP.slice(APP.indexOf('const goBack = useCallback((fallback = "roleSelect") => {'), APP.indexOf("const backTo = useCallback")));
    expect(gb).toContain("chatReturn(st.length);");
  });
});

describe("v190 · Наставник и чат открывают одинаково", () => {
  it("assistantNavigate без второго аргумента, всё через navigate", () => {
    expect(APP).toContain("const assistantNavigate = (dest) => {");
    expect(APP).not.toMatch(/assistantNavigate\([^)]*,\s*(true|false)\)/);
    const fn = code(APP.slice(APP.indexOf("const assistantNavigate = (dest) => {"), APP.indexOf("const assistantNavigate = (dest) => {") + 3000));
    expect(fn).not.toContain('setPrevScreen("roleSelect")');
  });
});

describe("v190 · крючки сборки для проверок", () => {
  it("сборка для просмотра: __saNav, __saScreen, __saStack, __saBack; якорь в App.jsx на месте", () => {
    const b = rd("tools/claude/build.mjs");
    for (const k of ["window.__saNav = navigate", "window.__saScreen = () => screenRef.current", "window.__saStack = () => navRef.current.slice()",
      "window.__saBack = () => { if (!clickScreenBack()) goBack(); }"]) expect(b, k).toContain(k);
    expect(APP).toContain('  const goBack = useCallback((fallback = "roleSelect") => {');
    expect(rd("tools/claude/demo-app/build.mjs")).toContain("const anchor = '  const goBack = useCallback((fallback = \"roleSelect\") => {';");
  });
});
