// v102 (Доп. 415): «Линза» на всех экранах. Владелец (29.10): «правильно будет добавить эффект линзы по всему
// приложению, чтобы визуально приложение было едино?» — «Да, давай». Линзой становится только то, что на экранах уже
// круглое (класс sa-lens на <html>, стили ui/home-look.jsx); новых плашек под значками нет. e2e — tools/claude/e2e-v102.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { LENS_CLASS, lensOn, homeLook, LOOK_DEFAULT } from "../lib/home-look.js";

const rd = (f) => readFileSync(f, "utf8");
const UI = readdirSync("ui").filter((f) => /\.jsx$/.test(f));

describe("v102: класс на <html>", () => {
  it("«Линза» — sa-lens на всех экранах; «как сейчас» — экраны прежние", () => {
    expect(LENS_CLASS).toBe("sa-lens");
    expect(lensOn("lens")).toBe(true);
    expect(lensOn("now")).toBe(false);
    expect(lensOn(LOOK_DEFAULT)).toBe(true);
    expect(lensOn(homeLook({ getItem: () => null }))).toBe(true);
  });
  it("App ставит и снимает класс вместе с видом и подключает стили", () => {
    const APP = rd("App.jsx");
    expect(APP).toContain('import { homeLook, LOOK_EVENT, LENS_CLASS, lensOn } from "./lib/home-look";');
    expect(APP).toContain('import { ensureLookCss } from "./ui/home-look";');
    expect(APP).toContain("try { document.documentElement.classList.toggle(LENS_CLASS, on); } catch (e) {}");
    expect(APP).toContain("if (on) ensureLookCss();");
    expect(APP).toContain("}, [look]);");
  });
});

describe("v102: стили", () => {
  const CSS = rd("ui/home-look.jsx");
  it("стекло, ободок и кольцо — те же, что на главной; светлая тема — тёмным золотом", () => {
    expect(CSS).toContain("html.sa-lens{--lk-gold:#C8A96E;");
    expect(CSS).toContain("html.sa-lens.sa-light{--lk-gold:#7A5D2A;");
    expect(CSS).toContain('content:"";position:absolute;inset:-3.5px;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(CSS).toContain("background:var(--lk-glass)!important;border-color:transparent!important;");
    expect(CSS).toContain("box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 12px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl),inset 0 -9px 12px -7px var(--tint,transparent)!important}");
    expect(CSS).toContain('html.sa-lens [data-lens="sos"]::after{border-color:rgba(var(--lk-sos),0.42)}');
  });
  it("«назад» — круглая линза 32 px со стрелкой посередине; поиск — круг 28 px", () => {
    expect(CSS).toContain('html.sa-lens [data-lens="back"]{width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;border-radius:50%!important;');
    expect(CSS).toContain("font-size:21px!important;line-height:1!important;color:var(--lk-gold)!important;padding:0 1px 3px 0!important}");
    expect(CSS).toContain("html.sa-lens [data-top-search][data-lens]{height:28px!important;border-radius:50%!important}");
  });
  it("кольцо привязано к самому кружку: у «Все темы списком» position:relative (иначе кольцо обходило весь ряд номеров)", () => {
    expect(CSS).toContain("html.sa-lens .tbp-view,html.sa-lens .tbm-act:not([disabled]) .tbm-act-ic,html.sa-lens .tg-more{position:relative}");
    expect(CSS).toContain("html.sa-lens [data-lens]{position:relative}");
  });
  it("правила — только под html.sa-lens (без класса экраны прежние до пикселя)", () => {
    const app = CSS.slice(CSS.indexOf("/* ── v102"), CSS.lastIndexOf("`;"));
    const rules = app.split("\n").filter((l) => /\{/.test(l) && !/^\s*\/\*/.test(l) && !/^\s*--/.test(l));
    for (const r of rules) expect(r.trim().startsWith("html.sa-lens"), r).toBe(true);
  });
});

describe("v102: что стало линзой", () => {
  it("каждая кнопка «назад» T.backBtn2 помечена data-lens=\"back\"", () => {
    let n = 0;
    for (const f of [...UI, "../App.jsx"]) {
      const src = rd(f.startsWith("..") ? f.slice(3) : "ui/" + f);
      for (const m of src.matchAll(/<button[^>]*style=\{T\.backBtn2\}[^>]*>/g)) { n++; expect(m[0], f).toContain('data-lens="back"'); }
    }
    expect(n).toBeGreaterThanOrEqual(36);
    expect(rd("ui/mastery.jsx")).toContain('style={{ ...TT.backBtn2, minWidth: 44, minHeight: 44, marginLeft: -10 }} data-lens="back"');
  });
  it("и нестандартные «‹»: график, колода, лаборатория, гид, аналитика, отчёты, печать, брифинг, сборка", () => {
    const files = { "schedule.jsx": 1, "cocktails.jsx": 1, "bar-lab.jsx": 1, "guide.jsx": 1, "screens-admin.jsx": 3, "report.jsx": 2, "menu-print.jsx": 1,
      "bar-card-print.jsx": 1, "cocktail-editor.jsx": 1, "offline.jsx": 1, "briefing.jsx": 2, "build.jsx": 1 };   // брифинг: и шапка T.backBtn2, и окно
    for (const [f, k] of Object.entries(files)) expect((rd("ui/" + f).match(/data-lens="back"/g) || []).length, f).toBe(k);
  });
  it("«Назад» Telegram ищет прежние кнопки: новых подписей «Назад» и role нет", () => {
    // колода: span без role (как до v71); аналитика — div без подписи
    expect(rd("ui/cocktails.jsx")).toContain('<span className="sa-hit" onClick={onBack} {...onActivate(onBack)} data-lens="back" style={{ color:GOLD');
    expect((rd("ui/screens-admin.jsx").match(/<div className="sa-hit" onClick=\{onBack\} \{\.\.\.onActivate\(onBack\)\} data-lens="back" style=/g) || []).length).toBe(3);
    expect(rd("ui/schedule.jsx")).toContain('onClick={onBack} aria-label="Назад" data-lens="back">‹</button>');
  });
  it("кружки: SOS (красные), сертификаты (оттенок роли), книга отзывов, наставник, аватарки, «Карта обучения», стрелки графика, колода, поиск", () => {
    expect((rd("ui/sos.jsx").match(/data-lens="sos"/g) || []).length).toBe(2);
    expect(rd("ui/screens-exam.jsx")).toContain('<div data-lens="disc" style={{ width:36, height:36, borderRadius:"50%", background:`${color}22`');
    expect(rd("ui/screens-exam.jsx")).toContain('"--tint": color + "55" }}>');
    expect(rd("ui/guestbook.jsx")).toContain('<div data-lens="disc" style={{ width: 42, height: 42, borderRadius: "50%"');
    expect(rd("ui/screens-team.jsx")).toContain('<div data-lens="avatar" style={{ width:54, height:54, borderRadius:"50%"');
    expect(rd("ui/screens-team.jsx")).toContain('<div data-lens="disc" style={{ width:34, height:34, borderRadius:"50%"');
    expect(rd("ui/screens-gamification.jsx")).toContain('<div data-lens="disc" style={{ width:48, height:48, borderRadius:"50%"');
    expect(rd("ui/screens-gamification.jsx")).toContain('<div data-lens="avatar" style={{ width:46, height:46, borderRadius:"50%"');
    expect((rd("ui/schedule.jsx").match(/data-lens="disc"/g) || []).length).toBe(3);
    expect(rd("App.jsx")).toContain('data-top-search data-lens="disc"');
  });
  it("кружки с состоянием — прежние: подтверждённый навык (зелёный ✓), открытый фильтр и список колоды", () => {
    expect(rd("ui/mentor.jsx")).toContain('data-lens={rec ? undefined : "disc"}');
    expect(rd("ui/cocktails.jsx")).toContain('data-lens={open ? undefined : "disc"}');
    expect(rd("ui/cocktails.jsx")).toContain('data-lens={view === "index" ? undefined : "disc"}');
  });
  it("значки в списках «Смены», «Команды» и «Я» — без кружков: плашки убраны намеренно (v78)", () => {
    // v111 (Доп. 424): линзы — только значки кнопок-групп (свёрнутая группа и группа из одного раздела) и «Жизни команды»;
    // строки внутри групп и плитки — без кружков, как было
    const src = rd("ui/home-hubs.jsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");   // без комментариев
    expect((src.match(/data-lens="disc"/g) || []).length).toBe(3);
    expect((src.match(/data-lens="disc" data-hub-disc=""/g) || []).length).toBe(2);
    const rows = src.slice(src.indexOf("function rowList(group)"), src.indexOf("const toggle = (name, names)"));
    expect(rows).toContain("data-hub-ic");
    expect(rows).not.toContain("data-lens=");
    const tile = src.slice(src.indexOf("const card = (it, idx) => {"), src.indexOf("const head = (g, k) =>"));
    expect(tile).not.toContain("data-lens=");
  });
});
