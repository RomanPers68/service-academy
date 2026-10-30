// v79 (Доп. 392): лёгкий старт. В стартовый файл больше не попадают экраны, которых нет на главной (руководителя,
// «Команды», рейтинга и статистики, экзамена, живого диалога), «тяжёлая» часть «Живого гостя» и меню-заготовки; уроки своей
// роли запрашиваются сразу при запуске; уборка банка ошибок (программа всех ролей) — только при ошибках в банке, раз в
// день и после показа главной; фоновый прогрев — когда главная уже на экране, собеседование — только руководителям.
// Шрифт заголовков Piazzolla — с нашего сервера (не jsDelivr/Google), Marck Script в Книге — свой файл; фото Справочника
// и значки кэшируются на сутки. Замер — CHANGES (Доп. 392), вид — tools/claude/e2e-v79.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

describe("v79: экраны не с главной — по требованию", () => {
  const app = code(rd("App.jsx"));
  it("App не тянет общий файл экранов: главная и урок — прямо, остальное — lazy", () => {
    expect(app).not.toMatch(/from "\.\/ui\/screens";/);
    expect(app).toContain('import { RoleSelect } from "./ui/screens-roleselect";');
    expect(app).toContain('import { MistakesScreen, HomeScreen, ModuleScreen, LessonScreen, GlossaryScreen, loadTable, useTableModule } from "./ui/screens-learning";');
    expect(app).toContain('import { APP_SHARE_URL } from "./lib/app-url";');
    expect(app).toContain("const lazyOf = (load, name) => lazy(() => retryImport(load).then(m => ({ default: m[name] })));");
    for (const [file, names] of [["screens-gamification", ["AchievementPopup", "RoleCompleteScreen", "LeaderboardScreen", "DailyScreen", "PlayerDetailScreen", "StatsScreen"]],
      ["screens-team", ["TeamScreen", "CodeLoginScreen", "AccountScreen"]], ["screens-admin", ["ChecklistScreen", "OnboardingScreen", "AnalyticsScreen"]],
      ["screens-exam", ["ExamScreen", "CertificateScreen", "CertificatesScreen"]], ["screens-dialogue", ["LiveDialogue"]]]) {
      expect(app).toContain(`() => import("./ui/${file}")`);
      for (const n of names) {
        expect([n, new RegExp(`const ${n} = lazyOf\\(load[A-Za-z]+, "${n}"\\);`).test(app)]).toEqual([n, true]);
        // каждый показ — внутри Suspense
        const uses = app.split("<" + n + " ").length - 1, wrapped = (app.match(new RegExp(`<Suspense fallback=\\{[^}]*(?:\\{[^}]*\\}[^}]*)?\\}><${n} `, "g")) || []).length;
        expect([n, uses > 0 && wrapped === uses]).toEqual([n, true]);
      }
    }
  });
  it("неиспользуемые импорты убраны: WeekStar, PS, ProfileScreen, POS_LABELS, константы чек-листов и онбординга, GLOSSARY", () => {
    for (const n of ["WeekStar", "ProfileScreen", "POS_LABELS", "DEFAULT_CHECKLISTS", "CL_KINDS", "_clYmd", "_clId", "DEFAULT_ONBOARDING", "ONB_TOTAL", "GLOSSARY"]) expect([n, new RegExp("\\b" + n + "\\b").test(app)]).toEqual([n, false]);
    expect(code(rd("ui/screens-roleselect.jsx"))).not.toMatch(/\bGLOSSARY\b/);
  });
  it("живой диалог в уроке — тоже лениво, внутри Suspense", () => {
    const src = code(rd("ui/screens-learning.jsx"));
    expect(src).toContain('const LiveDialogue = React.lazy(() => import("./screens-dialogue").then((m) => ({ default: m.LiveDialogue })));');
    expect(src).toContain("<React.Suspense fallback={null}><LiveDialogue dialogueId={dialogueScreen}");
    expect(src).not.toMatch(/import \{ LiveDialogue \} from "\.\/screens-dialogue";/);
  });
  it("ссылка «поделиться» — lib/app-url.js; screens-gamification переэкспортирует её под прежним именем", async () => {
    const { APP_SHARE_URL } = await import("../lib/app-url.js");
    expect(APP_SHARE_URL).toBe("https://t.me/SA_RestaurantBot");
    expect(rd("ui/screens-gamification.jsx")).toContain('export { APP_SHARE_URL } from "../lib/app-url";');
  });
});

describe("v79: «Живой гость» — лёгкая часть отдельно", () => {
  it("главная берёт подпись и историю из lib/guest-lite.js; lib/live-guest.js переэкспортирует — значения прежние", async () => {
    expect(code(rd("App.jsx"))).toContain('import { readGuestRuns, guestSub } from "./lib/guest-lite";');
    const lite = await import("../lib/guest-lite.js"), full = await import("../lib/live-guest.js");
    expect(full.guestSub).toBe(lite.guestSub);
    expect(full.readGuestRuns).toBe(lite.readGuestRuns);
    expect(full.placeOf).toBe(lite.placeOf);
    expect(full.GUEST_RUNS_KEY).toBe("sa_guest_runs");
    expect(lite.guestSub("seasonal", "waiter")).toBe("Гость-ИИ из твоего меню · чек разбора");   // v110: короче
    expect(lite.guestSub("spg")).toBe("Гость-ИИ у входа · чек разбора");   // v110: короче
    expect(lite.placeOf("", "senior_bartender")).toBe("bar");
    expect(code(rd("lib/guest-lite.js"))).not.toMatch(/^import /m);   // без зависимостей
  });
});

describe("v79: книга отзывов без меню-заготовок на старте", () => {
  const store = {};
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }; });
  it("data/reviews.js не импортирует data/menu.js; новинки — только свои блюда за 30 дней", async () => {
    expect(code(rd("data/reviews.js"))).not.toMatch(/from "\.\/menu"/);
    const { countNewDishes } = await import("../data/reviews.js");
    const now = Date.now();
    store.sa_menu_custom = JSON.stringify({ "Два моря, Океан": [{ id: "a", isNew: true, addedAt: now - 5 * 864e5 }, { id: "b", isNew: true, addedAt: now - 40 * 864e5 }, { id: "c" }] });
    expect(countNewDishes("Два моря, Океан")).toBe(1);
    expect(countNewDishes("Марико")).toBe(0);
    expect(countNewDishes("")).toBe(0);
    const { RESTAURANT_MENUS } = await import("../data/menu.js");
    expect(Object.values(RESTAURANT_MENUS).flat().some((d) => d.isNew)).toBe(false);   // у заготовок пометки «новинка» нет
  });
});

describe("v79: загрузки на старте", () => {
  const app = code(rd("App.jsx"));
  it("уроки своей роли — сразу из main.jsx (профиль и последняя роль с телефона)", () => {
    const main = code(rd("main.jsx"));
    expect(main).toContain('import { loadRoleModules } from "./data/modules";');
    expect(main).toContain('const r = uk ? JSON.parse(localStorage.getItem("sa_last_role" + uk) || "null") : null;');
    expect(main).toContain('if (typeof r === "string" && r) loadRoleModules(r).catch(() => {});');
  });
  it("уборка банка ошибок — только при ошибках, раз в день на человека, через 6 с и не на бережной сети", () => {
    expect(app).toContain("const hasMistakes = mistakeBank.length > 0;");
    expect(app).toContain("if (!customLoaded || !hasMistakes) return; let alive = true;");
    expect(app).toContain('const day = ymd(new Date()), key = "sa_mb_clean" + ukP;');
    expect(app).toContain("try { if (localStorage.getItem(key) === day) return; } catch (e) {}");
    expect(app).toContain("if (thriftyNet()) return;");
    expect(app).toContain("try { localStorage.setItem(key, day); } catch (e) {}");
    expect(app).toContain("}).catch(() => {}), 6000);");
    expect(app).toContain("}, [customLoaded, customByRole, hasMistakes, ukP]);");
  });
  it("фоновый прогрев — после показа главной; собеседование — только руководителям; новые ленивые экраны — в прогреве", () => {
    expect(app).toContain('const shown = !document.getElementById("sa-splash") && !!document.querySelector("[data-now-title]");');
    expect(app).toContain("if (!shown && Date.now() - t0 < 12000) { warm = setTimeout(waitHome, 400); return; }");
    expect(app).toContain('const boss = !!(pf && (pf.is_admin || ["manager", "senior"].includes(pf.position)));');
    expect(app).toContain('boss && (() => import("./ui/candidate")),');
    expect(app).toContain("() => loadOpenModules(pf),");
    // после открытых ролей — остальные: книга отзывов, её плитка и статистика считают по программе всех ролей
    expect(app.indexOf("() => loadAllModules(),")).toBeGreaterThan(app.indexOf("() => loadOpenModules(pf),"));
    expect(app.indexOf("() => loadAllModules(),")).toBeLessThan(app.indexOf("() => loadDialogueScreen(),"));
    for (const l of ["loadDialogueScreen()", "loadGamification()", "loadAdminScreens()", "loadTeamScreens()", "loadExamScreens()"]) expect([l, app.includes("() => " + l + ",")]).toEqual([l, true]);
    expect(app).toContain("if (!thriftyNet()) warm = setTimeout(waitHome, 400);");
    expect(app).not.toContain("}, 1500);\n    return () => { if (warm) clearTimeout(warm); };");
  });
  it("экраны, которые считают по всем ролям, сами догружают программу (раньше её на старте тянула уборка банка)", () => {
    const uc = code(rd("lib/use-content.js"));
    expect(uc).toContain('import { contentVersion, onContentChange, loadAllModules } from "../data/modules";');
    expect(uc).toMatch(/export function useAllModules\(\) \{\s*const v = useContentVersion\(\);\s*useEffect\(\(\) => \{ loadAllModules\(\)\.catch\(\(\) => \{\}\); \}, \[\]\);\s*return v;\s*\}/);
    const gb = code(rd("ui/guestbook.jsx"));
    expect(gb).toContain('import { useAllModules } from "../lib/use-content";');
    expect(gb).toContain("const contentVer = useAllModules();");
    expect(gb).not.toContain("useContentVersion");
    // страницы вкладки, даты, витрина сборки и точки непрочитанного пересчитываются, когда роли догрузились
    expect(gb).toContain("}, [tab, completed, quizDone, examResults, dates, wid, gold, contentVer]);");
    expect(gb).toContain("}, [completed, quizDone, examResults, readList, contentVer]);");
    expect(gb).toContain('(BM().bar || []).flatMap(m => (m.lessons || []).filter(l => l.type === "build")), [contentVer]);');
    const gm = code(rd("ui/screens-gamification.jsx"));
    expect(gm).toMatch(/export function PlayerDetailScreen\(\{ player, T, onBack \}\) \{\s*useAllModules\(\);/);
    expect(gm).toMatch(/export function StatsScreen\([^)]*\) \{\s*useAllModules\(\);/);
    expect(code(rd("ui/screens-admin.jsx"))).toContain("const contentVerA = useAllModules();");
  });
  it("светлый логотип заранее не качается (на экранах он не рисуется)", () => {
    const logo = code(rd("assets/logo.js"));
    expect(logo).toContain("hold(LOGO_SRC_DARK, (u) => { LOGO_SRC_DARK = u; });");
    expect(logo).not.toContain("hold(LOGO_SRC, ");
    expect(logo).toContain('export let LOGO_SRC = "/assets/logo-light.webp";');
  });
});

describe("v79: шрифты — со своего сервера", () => {
  it("Piazzolla 700 — @font-face на свои файлы (кириллица и латиница), без jsDelivr и Google Fonts", () => {
    const html = rd("index.html");
    expect(html).not.toMatch(/jsdelivr|googleapis|gstatic/);
    expect(html).toContain('@font-face{font-family:"Piazzolla";font-style:normal;font-weight:700;font-display:swap;src:url(/assets/fonts/piazzolla-cyrillic-700-normal.woff2) format("woff2");unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}');
    expect(html).toContain('src:url(/assets/fonts/piazzolla-latin-700-normal.woff2) format("woff2");unicode-range:U+0000-00FF,');
    for (const f of ["piazzolla-cyrillic-700-normal.woff2", "piazzolla-latin-700-normal.woff2", "Piazzolla-OFL.txt"]) expect([f, existsSync("public/assets/fonts/" + f)]).toEqual([f, true]);
    expect(rd("public/assets/fonts/Piazzolla-OFL.txt")).toContain("SIL Open Font License");
    // файлы — настоящие woff2
    for (const f of ["piazzolla-cyrillic-700-normal.woff2", "piazzolla-latin-700-normal.woff2"]) expect(readFileSync("public/assets/fonts/" + f).subarray(0, 4).toString("latin1")).toBe("wOF2");
  });
  it("Книга отзывов — без @import Google Fonts; Marck Script — свой (стили стола подключаются при открытии книги)", () => {
    const gb = code(rd("ui/guestbook.jsx"));
    expect(gb).not.toMatch(/googleapis|@import/);
    expect(gb).toContain('import { ensureTableCss } from "./table-css";');
    expect(gb).toMatch(/export function GuestBookScreen\([^)]*\) \{\n  ensureTableCss\(\);/);
    expect(rd("ui/table-css.js")).toContain("@font-face{font-family:'Marck Script';src:url(${HAND_FONT_URL}) format('woff')");
  });
});

describe("v79: кэш картинок на Vercel", () => {
  it("/reference и /icons — на сутки, как /menu; /assets — навсегда; остальное — без кэша, как было", () => {
    const v = JSON.parse(rd("vercel.json"));
    const cc = (src) => ((v.headers.find((h) => h.source === src) || {}).headers || []).find((x) => x.key === "Cache-Control")?.value;
    expect(cc("/reference/(.*)")).toBe("public, max-age=86400");
    expect(cc("/icons/(.*)")).toBe("public, max-age=86400");
    expect(cc("/menu/(.*)")).toBe("public, max-age=86400");
    expect(cc("/assets/(.*)")).toBe("public, max-age=31536000, immutable");
    expect(cc("/(.*)")).toBe("no-cache, no-store, must-revalidate");
    // частные правила — после общего «/(.*)» (на Vercel побеждает последнее совпавшее)
    const at = (src) => v.headers.findIndex((h) => h.source === src);
    for (const s of ["/assets/(.*)", "/menu/(.*)", "/reference/(.*)", "/icons/(.*)"]) expect([s, at(s) > at("/(.*)")]).toEqual([s, true]);
  });
});

describe("v79: метка и журнал", () => {
  it("«сборка v79», «Дополнение 392»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(79|[89]\d|\d{3,})<\/span>/);   // v79 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 392 — лёгкий старт: только нужное на главной, свой шрифт заголовков, кэш картинок (v79)");
  });
});
