// v59 (Доп. 372): что заметил на обходе ролей — контраст вкладок, слова, мелкие тексты, квест в выходной, подсказки
// по одной, свёрнутые треки, тема по системе, шрифт для Android, логотип из бандла, бережное обновление, личный ключ
// роли, уборка обходов открытым ключом и дублей словарей.
//
// Владелец: «Давай поправим все, вместе с серверными изменениями😉». Вид в браузере — tools/claude/e2e-v59.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { MONTH_GEN, MONTH_SHORT, WEEKDAY_CAP, WEEKDAY_SHORT, WEEKDAY_MON_SHORT, dayLabel, dateWords } from "../lib/dates.js";
import { POSITION_LABEL, POS_LABELS, POSITIONS, positionLabel } from "../data/positions.js";
import { ROLES, ROLE_LABEL, ROLE_COLOR, roleLabel } from "../data/roles.js";
import { ROLE_TITLE } from "../lib/mastery.js";
import { POSITION_LABEL as REPORT_POS } from "../lib/report-model.js";
import { systemLight, watchSystemTheme, THEME_AUTO_KEY } from "../lib/theme.js";
import { HINT_GAP_MS } from "../ui/widgets.jsx";

const rd = (f) => readFileSync(f, "utf8");

// контраст по WCAG — чтобы цифры в журнале были проверяемыми
const lum = (hex) => { const c = hex.replace("#", ""); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(parseInt(c.slice(0, 2), 16)) + 0.7152 * f(parseInt(c.slice(2, 4), 16)) + 0.0722 * f(parseInt(c.slice(4, 6), 16)); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

describe("v59: контраст и слова", () => {
  it("неактивные вкладки и «линзы» — #A6926C без прозрачности: контраст на тёмном ≥ 6:1 (было #7A654C — 3,4:1)", () => {
    expect(contrast("#A6926C", "#14110A")).toBeGreaterThan(6);
    expect(contrast("#7A654C", "#14110A")).toBeLessThan(3.5);
    const tb = rd("ui/tabbar.jsx");
    expect((tb.match(/const dim = a11y \? "#5C3D10" : "#A6926C";/g) || []).length).toBe(2);
    expect(tb).not.toContain("opacity: lit ? 1 : 0.72");
    expect(tb).not.toContain("opacity: lit ? 1 : 0.8, transition:\"color");
    expect(rd("ui/widgets.jsx")).toContain('const dim = muted || (a11y ? "#5C3D10" : "#A6926C");');
    expect(rd("ui/widgets.jsx")).toContain("opacity: active ? 1 : 0.92,");
  });
  it("слов «администратор» в экранах больше нет: код выдаёт руководитель, чип владельца — «ВЛАДЕЛЕЦ»", () => {
    const team = rd("ui/screens-team.jsx");
    expect(team).toContain("Введи код доступа — его выдаёт руководитель.");
    expect(team).toContain("Нет кода? Спроси у руководителя —<br/>он создаст тебя в системе за минуту.");
    expect(team).toContain("обратись к руководителю.");
    expect((team.match(/>ВЛАДЕЛЕЦ<\/span>/g) || []).length).toBe(2);
    for (const f of ["App.jsx", "ui/screens-team.jsx", "ui/screens-roleselect.jsx", "ui/screens-admin.jsx", "data/hints.js"]) expect(rd(f)).not.toMatch(/администратор|АДМИН\b/);
  });
  it("мелкие тексты: «Ролей завершено N/6», склонение «вопросов», неразрывный «— N», карточка про кнопку AI на компьютере", () => {
    const G = rd("ui/screens-gamification.jsx");
    expect(G).toContain("const rolesCompleted = STAT_ROLES.filter(r => completedRoles.has(r)).length;");
    expect(G).toContain("value:`${rolesCompleted}/${STAT_ROLES.length}`");
    const L = rd("ui/screens-learning.jsx");
    expect(L).toContain('plural3(waiting, "вопрос закрепляется", "вопроса закрепляются", "вопросов закрепляются")');
    expect(L).not.toContain("вопрос(ов)");
    expect(rd("ui/guestbook.jsx")).toContain("` · до «${stats.next.label}»\\u00a0—\\u00a0${stats.next.min - stats.score}`");
    expect(rd("App.jsx")).toContain("Стеклянная кнопка «AI» внизу справа (на компьютере — в меню слева) — наставник.");
  });
  it("«Квест смены» в выходной: без личных заданий, «Сегодня у тебя выходной» вместо «квест не загрузился»", () => {
    const t = rd("ui/together.jsx");
    expect(t).toContain('lead = false, shift = "", off = false, data, onReload, onTask, onComplete }) {');
    expect(t).toContain("const restDay = off && !(team && team.me_on);");
    expect(t).toContain("const myTasks = restDay ? [] : tasks;");
    expect(t).toContain('<><div className="tg-h">Сегодня у тебя выходной</div><div className="tg-sub">Квест смены — в рабочий день. Отдыхай ✦</div></>');
    expect(rd("App.jsx")).toContain("shift={shiftText} off={!!(shiftToday && shiftToday.off)}");
  });
});

describe("v59: подсказки, треки, тема", () => {
  it("подсказки — не чаще одной за 10 минут; та же подсказка в окне не считается; отложенная не помечается просмотренной", () => {
    expect(HINT_GAP_MS).toBe(600000);
    const w = rd("ui/widgets.jsx");
    expect(w).toContain("export function hintBudgetFree(key, now = Date.now()) {");
    expect(w).toContain("return last.k === key || now - last.t >= HINT_GAP_MS;");
    expect(w).toMatch(/      if \((!chain && )?!hintBudgetFree\(key\)\) return;\n      localStorage\.setItem\(HINT_LAST, JSON\.stringify\(\{ k: key, t: Date\.now\(\) \}\)\);\n      setOn\(true\);/);   // v62: chain — продолжение тура без паузы
  });
  it("главная на телефоне: с треком список треков свёрнут в строку «Треки обучения · ещё N ›»; «сменить» раскрывает; с «Сменить» из трека — открыт сразу", () => {
    const rs = rd("ui/screens-roleselect.jsx");
    expect(rs).toContain("const showList = !role || wideCols || listOpen;");
    expect(rs).toContain('data-tracks-toggle={listOpen ? "open" : "closed"} aria-expanded={listOpen}');
    expect(rs).toMatch(/\{listOpen \? "Свернуть" : ("ещё " \+ Math\.max\(0, ROLES\.length - 1\)|"подробнее")\}/);   // v61: «подробнее» (ряд узлов показывает все треки)
    expect(rs).toContain('<div style={T.roleList} className="sa-stagger" data-tracks-list="">');
    expect(rs).toContain("const toTracks = () => { if (showList) { scrollTracks(); return; } wantScroll.current = true; setListOpen(true); };");
    const app = rd("App.jsx");
    expect(app).toContain('onChangeRole={() => { setTracksWanted(true); navigate("roleSelect"); }}');
    expect(app).toContain("roleAuto={roleAuto} tracksOpen={tracksWanted}");
  });
  it("тема как в системе: Telegram первым, иначе медиазапрос; ручной выбор снимает автоматику", () => {
    expect(THEME_AUTO_KEY).toBe("sa_theme_auto");
    expect(systemLight(null)).toBe(false);
    expect(systemLight({ Telegram: { WebApp: { colorScheme: "light" } } })).toBe(true);
    expect(systemLight({ Telegram: { WebApp: { colorScheme: "dark" } }, matchMedia: () => ({ matches: true }) })).toBe(false);
    expect(systemLight({ matchMedia: (q) => ({ matches: q.includes("light") }) })).toBe(true);
    const calls = [];
    const off = watchSystemTheme((v) => calls.push(v), { matchMedia: () => ({ matches: true, addEventListener: (t, h) => calls.push("sub:" + t), removeEventListener: () => calls.push("unsub") }) });
    off();
    expect(calls).toEqual(["sub:change", "unsub"]);
    const app = rd("App.jsx");
    expect(app).toContain("const setA11y = useCallback((v) => { setA11yState(v); setThemeAuto(false); setThemeAutoState(false); }, []);");
    expect(app).toContain("useEffect(() => { if (!themeAuto) return undefined; return watchSystemTheme((light) => setA11yState(light)); }, [themeAuto]);");
    expect(rd("ui/screens-team.jsx")).toContain('row("auto", "Тема как в системе",');
  });
});

describe("v59: шрифт, логотип, обновление", () => {
  it("Georgia через @font-face с local(): на iPhone — своя, без Georgia — PT Serif из /assets/fonts (кириллица и латиница, 400/700 и курсив)", () => {
    const html = rd("index.html");
    expect((html.match(/@font-face\{font-family:"Georgia"/g) || []).length).toBe(8);
    expect(html).toContain('src:local("Georgia"),url(/assets/fonts/pt-serif-cyrillic-400-normal.woff2) format("woff2");unicode-range:U+0301,U+0400-045F');
    expect(html).toContain('src:local("Georgia Bold"),local("Georgia-Bold"),url(/assets/fonts/pt-serif-cyrillic-700-normal.woff2)');
    expect(html).toContain('font-style:italic;font-weight:400;font-display:swap;src:local("Georgia Italic"),local("Georgia-Italic"),url(/assets/fonts/pt-serif-cyrillic-400-italic.woff2)');
    // общие правила без диапазона — первыми, чтобы правила с диапазонами побеждали при совпадении кодов
    expect(html.indexOf('@font-face{font-family:"Georgia";font-style:normal;font-weight:400;src:local("Georgia")}')).toBeLessThan(html.indexOf("pt-serif-cyrillic-400-normal"));
    for (const f of ["cyrillic-400-normal", "cyrillic-700-normal", "cyrillic-400-italic", "latin-400-normal", "latin-700-normal", "latin-400-italic"]) expect(existsSync("public/assets/fonts/pt-serif-" + f + ".woff2")).toBe(true);
    expect(existsSync("public/assets/fonts/PT-Serif-LICENSE.txt")).toBe(true);
  });
  it("логотипы — файлы в public/assets, а не base64 в коде", () => {
    const logo = rd("assets/logo.js");
    expect(logo).toContain('export const LOGO_SRC = "/assets/logo-light.webp";');
    expect(logo).toContain('export const LOGO_SRC_DARK = "/assets/logo-dark.webp";');
    expect(logo.length).toBeLessThan(2000);
    expect(existsSync("public/assets/logo-dark.webp") && existsSync("public/assets/logo-light.webp")).toBe(true);
  });
  it("обновление: при открытии — перезагрузка, позже — тост «Готова новая версия · Обновить» (кнопки «Обновить» и «Позже»)", () => {
    const m = rd("main.jsx");
    expect(m).toContain('if (performance.now() < 5000) window.location.reload(); else announceUpdate();');
    expect(m).toContain('if (reason === "load") window.location.reload(); else announceUpdate();');
    expect(m).toContain('window.addEventListener("load", () => setTimeout(() => check("load"), 1200));');
    expect(m).toContain('window.__saUpdateReady = true; window.dispatchEvent(new CustomEvent("sa-update-ready"));');
    const u = rd("ui/update-toast.jsx");
    expect(u).toContain('window.addEventListener("sa-update-ready", h);');
    expect(u).toContain('data-update-now=""');
    expect(u).toContain('data-update-later=""');
    expect(rd("App.jsx")).toContain("{profile ? <UpdateToast a11y={a11y} /> : null}");
  });
});

describe("v59: личные ключи, обходы, словари", () => {
  it("роль — личный ключ sa_last_role<uk>; общий ключ не читаем и подчищаем", () => {
    const app = rd("App.jsx");
    expect(app).toContain('const lr = ukR ? await storageGet("sa_last_role" + ukR) : null; if (lr) setRole(JSON.parse(lr.value)); } catch(e) {}');
    expect(app).toContain('try { localStorage.removeItem("sa_last_role"); } catch(e) {}');
    expect(app).toContain('localStorage.setItem("sa_last_role" + uk, JSON.stringify(res.last_role));');
    expect(app).toContain('localStorage.setItem("sa_last_role" + ukP, JSON.stringify(role));');
    expect(app).toContain('localStorage.setItem("sa_last_role" + (profile ? `_${profile.name}_${profile.surname || ""}` : ""), JSON.stringify(r));');
    expect(app).not.toMatch(/storageGet\("sa_last_role"\)/);
  });
  it("запасных чтений таблиц открытым ключом больше нет (profiles, scores, progress, quiz_done, practice_stars…)", () => {
    const app = rd("App.jsx");
    expect(app).not.toContain("rest/v1/");
    expect(app).not.toContain("loadLegacyProgress(");
    expect(app).not.toContain("supabase.from(");
    expect(app).not.toMatch(/import \{[^}]*SUPABASE_KEY[^}]*\} from "\.\/api\/supabase"/);
    const g = rd("ui/screens-gamification.jsx");
    expect(g).not.toContain("rest/v1/");
    expect(g).not.toMatch(/import \{[^}]*SUPABASE_KEY[^}]*\} from "\.\.\/api\/supabase"/);
  });
  it("lib/dates.js — один словарь дат; копии в отчёте, «Пути мастера», графике, «Смене» и «Заданиях дня» ссылаются на него", () => {
    expect(MONTH_GEN[9]).toBe("октября"); expect(MONTH_SHORT[4]).toBe("мая"); expect(WEEKDAY_CAP[0]).toBe("Воскресенье");
    expect(WEEKDAY_SHORT[1]).toBe("пн"); expect(WEEKDAY_MON_SHORT[6]).toBe("вс");
    expect(dayLabel(new Date(2026, 9, 18))).toBe("Воскресенье, 18 октября");
    expect(dateWords(new Date(2026, 0, 1), true)).toBe("1 января 2026");
    expect(rd("lib/report-model.js")).toContain("const MONTHS = MONTH_GEN, MON3 = MONTH_SHORT, WD = WEEKDAY_SHORT;");
    expect(rd("ui/mastery.jsx")).toContain("const MON = MONTH_SHORT, MONTHS = MONTH_GEN;");
    expect(rd("ui/schedule.jsx")).toContain("const DOWL = WEEKDAY_MON_SHORT, DOWF = WEEKDAY_MON, MONTHS_N = MONTH_NOM, MONTHS_R = MONTH_GEN;");
    expect(rd("ui/home-hubs.jsx")).toContain("const DAYS = WEEKDAY, MONTHS = MONTH_GEN;");
    expect(rd("ui/screens-gamification.jsx")).toContain("export const dayLabelRu = dayLabel;");
    expect(rd("lib/month-recap.js")).toContain("export const MONTH = MONTH_NOM; export { MONTH_GEN, MONTH_PREP, MONTH_INS };");
    const copies = ["lib/report-model.js", "ui/mastery.jsx", "ui/schedule.jsx", "ui/home-hubs.jsx", "ui/screens-gamification.jsx", "lib/master-image.js", "lib/month-recap.js"]
      .filter((f) => /"января", "февраля"|"января","февраля"/.test(rd(f)));
    expect(copies).toEqual([]);
  });
  it("должности и роли — из data/positions.js и data/roles.js; хостес больше нигде не «СПГ»", () => {
    expect(POSITIONS.length).toBe(6);
    expect(POS_LABELS.senior).toBe("Руководящий состав");
    expect(POSITION_LABEL.owner).toBe("Владелец");
    expect(positionLabel("chef")).toBe("Повар"); expect(positionLabel("x")).toBe("x"); expect(positionLabel(undefined)).toBe("");
    expect(REPORT_POS).toBe(POSITION_LABEL);
    expect(ROLE_LABEL.spg).toBe("Хостес"); expect(roleLabel("bar")).toBe("Бар"); expect(ROLE_COLOR.seasonal).toBe("#7C9E87");
    expect(Object.keys(ROLE_LABEL).length).toBe(ROLES.length);
    expect(ROLE_TITLE).toBe(ROLE_LABEL);
    const g = rd("ui/screens-gamification.jsx");
    expect(g).toContain("export { POS_LABELS };");
    expect(g).toContain("const POSITION_RU = POSITION_LABEL;");
    expect((g.match(/const roleLabel = ROLE_LABEL, roleColor = ROLE_COLOR;/g) || []).length).toBe(2);
    expect(g).toContain("const roleNames = ROLE_LABEL, roleColors = ROLE_COLOR;");
    expect(g).not.toContain('"СПГ"');
    expect(rd("ui/screens-admin.jsx")).toContain("const POS = POS_LABELS;");
    expect(rd("ui/screens-team.jsx")).toContain("const posLabel = positionLabel(profile?.position);");
    expect(rd("ui/training-card.jsx")).toContain("const posLabel = positionLabel(profile?.position);");
  });
});

describe("v59: метка и журнал", () => {
  it("метка сборки — v59; CHANGES — «Дополнение 372»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2}<\/span>/);   // v60 — следующая метка;
    expect(rd("CHANGES.md")).toContain("# Дополнение 372 — что заметил на обходе: контраст, слова, выходной, подсказки, тема, шрифт, обновление, уборка (v59)");
  });
});
