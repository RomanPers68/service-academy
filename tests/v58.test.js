// v58 (Доп. 371): остальные неудобства из аудита — тексты приветствия для новичка, трек по должности, пустые экраны
// («Работа над ошибками», «Статистика»), дата словами, мелкий текст (вкладки 11 px, метки от 10,5 px), обрезки
// (погреб, лидеры, вкладки «Книги отзывов»), заголовок «Меню», надписи «для разработчика» — человеческим языком.
//
// Владелец: «Давай все😉 И да, пройди и собери неудобства, пожалуйста ☺️». Вид в браузере — tools/claude/e2e-v58.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { trackForPosition, POS_TRACK } from "../lib/position-track.js";
import { serverMissing, serverError, serverStage } from "../lib/server-text.js";

const rd = (f) => readFileSync(f, "utf8");

describe("v58: трек по должности (неудобство 3)", () => {
  it("официант — «Новичок», хостес — «Хостес», бармены — «Бар», менеджер — «Менеджер», старший — «Сервис-менеджер»; владелец и повар — выбирают сами", () => {
    expect(trackForPosition({ position: "waiter" })).toBe("seasonal");
    expect(trackForPosition({ position: "hostess" })).toBe("spg");
    expect(trackForPosition({ position: "bartender" })).toBe("bar");
    expect(trackForPosition({ position: "senior_bartender" })).toBe("bar");
    expect(trackForPosition({ position: "manager" })).toBe("manager");
    expect(trackForPosition({ position: "senior" })).toBe("service_manager");
    expect(trackForPosition({ position: "owner" })).toBe(null);
    expect(trackForPosition({ position: "chef" })).toBe(null);
    expect(trackForPosition(null)).toBe(null);
    expect(trackForPosition({})).toBe(null);
    expect(Object.keys(POS_TRACK).length).toBe(6);
  });
  it("отчёт по сотруднику берёт тот же словарь — один источник", () => {
    const rm = rd("lib/report-model.js");
    expect(rm).toContain('import { POS_TRACK } from "./position-track.js";');
    expect(rm).not.toMatch(/const POS_TRACK = \{/);
  });
  it("App: роль не выбрана — трек по должности; выбранная раньше (сервер) главнее; принят — запоминается как выбранная", () => {
    const app = rd("App.jsx");
    expect(app).toContain('import { trackForPosition } from "./lib/position-track";');
    expect(app).toContain("const [roleAuto, setRoleAuto] = useState(false);");
    expect(app).toContain("    if (roleRef.current && !roleAutoRef.current) return;\n    const t = trackForPosition(profile);");
    // сервер: last_role перекрывает подставленный трек без перехода на экран (человек уже на главной)
    expect(app).toContain("if (res.last_role && (!roleRef.current || roleAutoRef.current)) {");
    expect(app).toMatch(/        setRole\(res\.last_role\); setRoleAuto\(false\);\n        try \{ localStorage\.setItem\("sa_last_role"( \+ uk)?, JSON\.stringify\(res\.last_role\)\); \} catch \(e\) \{\}\n        if \(!wasAuto\) setScreen\("home"\);/);   // v59: ключ личный
    // принят: открыл программу или урок — сохраняем, но только после ответа сервера про роль (roleChecked)
    expect(app).toContain("    if (!roleAuto || !role || !profile || !roleChecked) return;\n    if (screen !== \"home\" && screen !== \"module\" && screen !== \"lesson\") return;");
    expect(app).toMatch(/rpcSync\("save_last_role", \{ p_token: saToken\(\), p_role: role \}\);\n  \}, \[roleAuto, role, screen, profile, roleChecked(, ukP)?\]\);/);   // v59: ключ роли личный
    // выбрал сам / вышел / сброс — флаг снимается
    expect(app).toContain("setRole(r); setRoleAuto(false);");
    expect(app).toContain("setRole(null); setRoleAuto(false);\n    setScreen(\"login\");");
    expect(app).toContain("firstDay={firstDay} roleAuto={roleAuto}");
  });
  it("главная: «по должности · сменить» под ролью; «сменить» ведёт к списку треков", () => {
    const rs = rd("ui/screens-roleselect.jsx");
    expect(rs).toMatch(/nowCard = null, nowOn = null, firstDay = false, roleAuto = false(, tracksOpen = false)?(, lateRow = null)? \}\) \{/);   // v99: lateRow — «Опаздываю?»
    expect(rs).toContain('по должности · <button type="button" data-role-change="" onClick={toTracks}');
    expect(rs).toMatch(/<(div|button type="button") ref=\{refTracks\} data-tracks-title=""/);
    expect(rs).toContain('<div ref={refTracks} data-home2-title="" data-tracks-title=""');
  });
});

describe("v58: тексты приветствия (неудобства 1–2)", () => {
  const app = rd("App.jsx");
  it("первая карточка — что где, а не «стало проще»; без слова «попап»; про кнопку — «Начать», потом «Дальше»", () => {
    expect(app).toContain('text: "«Учусь»: уроки и тесты твоей роли. «Смена»: рабочий день, график и чек-листы. «Команда»: коллеги и рейтинг. «Я»: твой прогресс и настройки." };');   // v74
    expect(app).not.toContain("Приложение стало проще");
    expect(app).toContain("Это окно больше не покажется, а гид останется.");
    expect(app).not.toMatch(/"[^"\n]*попап[^"\n]*"/);
    expect(app).toContain("Большая карточка на главной ведёт к следующему шагу: сначала «Начать», потом «Дальше».");   // v74
  });
});

describe("v58: пустые экраны и дата (неудобства 7–9)", () => {
  it("«Работа над ошибками» без единого теста — «Пока пусто», без конфетти; с тестами без ошибок — как было", () => {
    const L = rd("ui/screens-learning.jsx");
    expect(L).toContain("export function MistakesScreen({ T, a11y, mistakeBank = [], onResolve, onFail, onBack, noTests = false }) {");
    expect(L).toContain("    if (noTests && waiting === 0) return (");
    expect(L).toContain('<div data-mistakes-empty="new"');
    expect(L).toContain("<div style={{ ...T.bold, marginBottom: 6 }}>Пока пусто</div>");
    expect(L).toContain("Сюда попадут вопросы, где ошибёшься в тестах. Они вернутся через день, три и неделю, пока не запомнятся.");   // v74
    expect(L).toContain('{UI_SVG.checkCircle(GREEN, 44)}</div>');   // праздник остался для тех, у кого тесты были (v75: значок вместо 🎉)
    expect(rd("App.jsx")).toContain("noTests={!myScores.length && !Object.keys(quizDone || {}).length}");
  });
  it("«Статистика» без прогресса — подсказка и кнопка «К первому уроку» вместо шести нулей; подсказка экрана ждёт", () => {
    const G = rd("ui/screens-gamification.jsx");
    expect(G).toContain("const empty = totalTests === 0 && completedLessons === 0 && !myStars && !Object.keys(quizDone || {}).length;");
    expect(G).toContain('const [stHint, stHintDone] = useHintOnce("stats", !empty);');
    expect(G).toContain('<div data-stats-empty=""');
    expect(G).toContain("Здесь появятся твои баллы");
    expect(G).toContain('data-stats-start="" className="sa-btn" onClick={onStart}');
    expect(G).toContain("{!empty ? <div style={{ display:\"grid\", gridTemplateColumns:\"1fr 1fr\", gap:8, marginBottom:12 }}>");
    expect(G).toContain("{myScores.length === 0 && !empty && (");
    expect(rd("App.jsx")).toContain("onStart={() => { const nx = nextLessonOf(programModules, completed, quizDone); if (nx && nx.lesson) { setActiveModule(nx.mod); openLesson(nx.lesson); } else navigate(\"roleSelect\"); }}");
  });
  it("«0 тестов», а не «0 теста»", () => {
    expect(rd("ui/screens-gamification.jsx")).toContain('{roleScores.length} {kk(roleScores.length, "тест", "теста", "тестов")}');
  });
  it("дата в «Заданиях дня» — «Воскресенье, 18 октября»; задания дня считаются от прежней даты (не перемешались)", async () => {
    const { dayLabelRu } = await import("../ui/screens-gamification.jsx");
    expect(dayLabelRu(new Date(2026, 9, 18))).toBe("Воскресенье, 18 октября");
    expect(dayLabelRu(new Date(2026, 0, 1))).toBe("Четверг, 1 января");
    const G = rd("ui/screens-gamification.jsx");
    expect(G).toContain('const today = new Date().toLocaleDateString("ru-RU");\n  const seed = today.split(".").reduce((a, v) => a + parseInt(v), 0);');
    expect(G).toContain('<div data-daily-date="" style={{ color: goldText(a11y), fontSize:16, fontFamily:"Georgia, serif" }}>{todayLabel}</div>');
  });
});

describe("v58: мелкий текст (неудобство 12)", () => {
  it("подписи вкладок — 11 px (были 9); на компьютере в меню слева — тоже 11", () => {
    const tb = rd("ui/tabbar.jsx");
    expect((tb.match(/fontSize:11, fontFamily:"Georgia, serif", letterSpacing:0.3, fontWeight:"bold"/g) || []).length).toBe(1);   // меню слева
    // нижняя панель: 11 px; v91 — 10 px только на узком экране (320 px), когда рядом круг чата и «Команда» иначе не входит
    expect(tb).toContain('fontSize: tight ? 10 : 11, fontFamily:"Georgia, serif", letterSpacing: tight ? 0 : 0.3, fontWeight:"bold"');
    expect(tb).toContain("const tight = cellW > 0 && cellW < 52;");
    expect(tb).not.toMatch(/fontSize:(9|10), fontFamily:"Georgia, serif"/);
  });
  it("в экранах приложения нет меток мельче 10,5 px (кроме печатных листов, графика и игрового стола «Сборки»)", () => {
    const skip = ["ui/schedule.jsx", "ui/menu-print.jsx", "ui/bar-card-print.jsx", "ui/training-card.jsx", "ui/reference-illustrations.jsx"];
    const files = ["App.jsx", ...readdirSync("ui").filter((f) => /\.(jsx|js)$/.test(f)).map((f) => "ui/" + f)].filter((f) => !skip.includes(f));
    const bad = [];
    for (const f of files) {
      const s = rd(f);
      const m = s.match(/fontSize:\s*(8|8\.5|9|9\.5)(?=\s*[,}\s])/g);
      if (m) bad.push(f + ":" + m.length);
    }
    expect(bad).toEqual([]);
    const st = rd("ui/styles.js");
    expect(st).toContain('secTitle: { ...labelStyle(13.5), color:"#C9A867", padding:"10px 20px 4px" },');   // v73: курсив 13,5 px — крупнее прежнего капса 10,5
    expect(st).toContain("modTag: { ...labelStyle(13), marginBottom:1 },");
    expect(rd("ui/css.js")).toContain("font-family:ui-monospace,Menlo,monospace;font-size:10.5px;color:#C8A96E}\n    .sa-step.done .sa-stepnum");
    expect(rd("ui/day-cards.jsx")).toContain(".sa-dp-cap{display:block;${LABEL_CSS};font-size:12.5px;");   // v73: курсивом
  });
});

describe("v58: обрезки и заголовки (неудобства 13, 14, 18, 19)", () => {
  it("погреб: название темы до двух строк, кнопка в строке — компактная, в две строки", () => {
    const c = rd("ui/cellar.jsx");
    expect(c).toContain('WebkitLineClamp: 2, overflow: "hidden", wordBreak: "break-word" };');
    expect(c).toContain('<div data-cellar-title="" style={title2}>{r.m.title}</div>');
    expect(c).toContain('maxWidth: primary ? undefined : 96, padding: primary ? "11px 16px" : "7px 12px", flexShrink: 0 });');
    expect(c).toContain('<button type="button" data-cellar-action="" style={rowBtn(a.primary)}');
  });
  it("вкладки-«линзы» переключаются и мышью: выбор — на отпускании указателя, клик-хвост кнопки гасится флагом (не временем)", () => {
    const w = rd("ui/widgets.jsx");
    expect(w).toContain("    dragEndAt.current = 1;\n    clearTimeout(pickTimer.current); pickTimer.current = setTimeout(() => { dragEndAt.current = 0; }, 350);");
    expect(w).toContain("if (dragEndAt.current) return; // клик-«хвост» после тапа или перетаскивания — выбор уже сделан в onUp");
    expect(w).not.toContain("if (!info.moved) return; // обычный тап обработает onClick кнопки");
  });
  it("лента вкладок с прокруткой: у края — намёк «листай» (›), выбранная подъезжает в видимую часть; вкладки «Книги отзывов» крупнее", () => {
    const w = rd("ui/widgets.jsx");
    expect(w).toContain("setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);");
    expect(w).toContain('<div aria-hidden data-seg-more=""');
    expect(w).toContain('try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) {}');
    expect(w).toContain("  if (!scroll) return track;");
    expect(rd("ui/guestbook.jsx")).toContain('itemStyle={{ padding: "8px 13px" }}');   // v73: шрифт — как у остальных переключателей
  });
  it("лидеры ресторана: медальон над именем — имя целиком; «Меню» — заголовок без названия ресторана дважды", () => {
    const h = rd("ui/home-hubs.jsx");
    expect(h).toContain('<div key={i} data-leader="" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textAlign: "center" }}>');
    expect(h).toContain('<div data-leader-name=""');
    const m = rd("ui/menu-trainer.jsx");
    expect(m).toContain('      {Head("Меню")}');
    expect(m).not.toContain("{Head(restaurant)}");
  });
});

describe("v58: надписи «для разработчика» — по-человечески (неудобства 16–17)", () => {
  it("lib/server-text: сотруднику — что и когда появится; владельцу — ещё и какой скрипт", () => {
    expect(serverMissing({ what: "отчёты", many: true })).toBe("Отчёты появятся, когда владелец обновит сервер.");
    expect(serverMissing({ what: "общая лига" })).toBe("Общая лига появится, когда владелец обновит сервер.");
    expect(serverMissing({ what: "отчёты", many: true, admin: true, sql: "supabase-stage23-reports.sql" }))
      .toBe("Отчёты появятся, когда владелец обновит сервер. Для владельца: примени supabase-stage23-reports.sql в Supabase → SQL Editor.");
    expect(serverMissing({ what: "отчёты", many: true, sql: "x.sql" })).not.toContain("x.sql");
    expect(serverError({ code: "PGRST202" })).toBe("Сервер ещё подхватывает обновление. Открой этот экран чуть позже.");   // v74: без тире
    expect(serverError({ code: "PGRST202", admin: true })).toContain("notify pgrst, 'reload schema'");
    expect(serverError({ message: "boom", code: "42" })).toBe("Сервер ответил ошибкой. Попробуй позже. Если повторится, скажи владельцу.");
    expect(serverError({ message: "boom", code: "42", admin: true })).toBe("Сервер ответил ошибкой: boom (42). Пришли этот текст разработчику.");
    expect(serverError({})).toBe("Нет связи с сервером. Попробуй ещё раз.");
    expect(serverStage({})).toBe("Сервер ещё не обновлён. Скажи владельцу.");
    expect(serverStage({ admin: true, sql: "a.sql" })).toBe("Сервер ещё не обновлён: примени a.sql.");
    expect(serverStage({ admin: true, stage: 26 })).toBe("Сервер ещё не обновлён: нужен этап 26.");
  });
  it("«Рейтинг»: «Рекорды не загрузились · Ещё раз» вместо «Нужен stage14 на сервере»; «Ещё раз» повторяет запрос", () => {
    const G = rd("ui/screens-gamification.jsx");
    expect(G).not.toContain("Нужен stage14");
    expect(G).toContain('Рекорды не загрузились · <span data-rec-retry="" role="button"');
    expect(G).toContain("const [recTry, setRecTry] = React.useState(0);");
    expect(G).toContain("  }, [profile?.restaurant, recTry]);");
  });
  it("в экранах не осталось «stage…», «примени supabase-…» и «этап N» в текстах для сотрудника", () => {
    const files = ["ui/screens-admin.jsx", "ui/screens-gamification.jsx", "ui/league.jsx", "ui/together.jsx", "ui/report.jsx", "ui/day-cards.jsx",
      "ui/screens-team.jsx", "ui/schedule.jsx", "ui/live-guest.jsx", "ui/mentor.jsx", "ui/mastery.jsx", "ui/menu-trainer.jsx"];
    const bad = [];
    for (const f of files) {
      rd(f).split("\n").forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "").replace(/\{\/\*.*?\*\/\}/g, "");
        // строки в кавычках с «этап N», «stage», «.sql» — кроме тех, что показываются только владельцу (admin / is_admin рядом)
        const strs = code.match(/"[^"]*"|'[^']*'|`[^`]*`/g) || [];
        for (const s of strs) {
          if (!/этап[а]? \d|stage\d|\.sql/i.test(s)) continue;
          if (/admin|is_admin|owner|владел/i.test(code)) continue;   // подсказка владельцу — осознанно (приз назначает только он)
          if (/supabase-stage\d+[a-z-]*\.sql"/.test(s) && /sql\s*[:=]/.test(code)) continue;   // имя скрипта передаётся в serverMissing/serverStage — покажется только владельцу
          bad.push(f + ":" + (i + 1) + " " + s.slice(0, 60));
        }
      });
    }
    expect(bad).toEqual([]);
    expect(rd("ui/screens-admin.jsx")).toContain('import { serverMissing, serverError } from "../lib/server-text";');
    expect(rd("ui/report.jsx")).toContain("const problem = (st) => st === \"missing\" ? serverMissing({ what: \"отчёты\", many: true, admin: !!(profile && profile.is_admin), sql: \"supabase-stage23-reports.sql\" })");
    expect(rd("ui/day-cards.jsx")).toContain('export function RemindSheet({ a11y, uk = "", lead = false, admin = false, shift = "", step = "", onClose, onChange }) {');
    expect(rd("App.jsx")).toContain("<RemindSheet a11y={a11y} uk={ukP} lead={isLead} admin={!!profile?.is_admin}");
  });
});

describe("v58: метка и журнал", () => {
  it("метка сборки — v58; CHANGES — «Дополнение 371»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d+<\/span>/);
    expect(rd("CHANGES.md")).toContain("# Дополнение 371 — неудобства из аудита: приветствие, трек по должности, пустые экраны, мелкий текст, надписи «для разработчика» (v58)");
  });
});
