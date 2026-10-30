// v117 (Доп. 430): «Команда и Я» в линзах. Владелец (30.10): «Пройдёмся по приложению, добьём то, что осталось? Чтобы
// приложение визуально было едино». Аккаунт и настройки, статистика, рейтинг и «Сотрудник недели», лига, книга отзывов,
// аналитика, отчёты, сервер, редакторы уроков, коктейлей и меню. Метки data-lens-* и раздел v117 в ui/home-look.jsx — всё
// под html.sa-lens, вид «как сейчас» прежний. e2e — tools/claude/e2e-v117.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const count = (s, sub) => s.split(sub).length - 1;
const LOOK = rd("ui/home-look.jsx");
const V117 = LOOK.slice(LOOK.indexOf("/* ── v117"), LOOK.lastIndexOf("`;"));
const rules = code(V117).split("}").map((r) => r.trim()).filter(Boolean);
const sels = rules.map((r) => r.split("{")[0].trim()).flatMap((s) => s.split(",").map((x) => x.trim()));
const lineOf = (src, label) => src.split("\n").find((l) => l.includes(label)) || "";

describe("v117: правила линзы (ui/home-look.jsx, раздел v117)", () => {
  it("раздел v117 после v116; каждое правило — только под html.sa-lens", () => {
    expect(LOOK.indexOf("/* ── v117")).toBeGreaterThan(LOOK.indexOf("/* ── v116"));
    expect(sels.length).toBeGreaterThan(15);
    for (const s of sels) expect(s, s).toMatch(/^html\.sa-lens(\.sa-light)?[ [:]/);
  });
  it("«нужно сделать» сервера — жёлтая кромка (warn) в обеих темах", () => {
    expect(V117).toContain('html.sa-lens [data-lens-card="warn"]{border-color:rgba(228,179,106,0.7)!important}');
    expect(V117).toContain('html.sa-lens.sa-light [data-lens-card="warn"]{border-color:rgba(139,90,18,0.6)!important}');
  });
  it("отчёты: правила — только в оболочке .rp; «Требуют внимания» сохраняет свою красную кромку", () => {
    for (const s of sels.filter((x) => /\.rp-/.test(x))) expect(s, s).toMatch(/^html\.sa-lens(\.sa-light)? \.rp \.rp-/);
    expect(V117).toContain("html.sa-lens .rp .rp-card,html.sa-lens .rp .rp-row:not(.att),html.sa-lens .rp .rp-tile,html.sa-lens .rp .rp-q{border-color:var(--lk-edge)}");
    expect(code(V117)).not.toMatch(/\.rp-row\.att\{[^}]*border-color/);
  });
  it("отчёты: главная кнопка — плашка с кольцом, остальные и фильтры — стекло, выбранный фильтр — плашка, поиск — стекло", () => {
    expect(V117).toMatch(/html\.sa-lens \.rp \.rp-btn\.main\{position:relative;color:var\(--lk-hi\);background:radial-gradient\(/);
    expect(V117).toContain('html.sa-lens .rp .rp-btn.main::after{content:"";position:absolute;inset:-3.5px;border-radius:999px;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(V117).toContain("html.sa-lens .rp .rp-btn:not(.main),html.sa-lens .rp .rp-chip:not(.on){background:var(--lk-glass);border-color:transparent;");
    expect(V117).toContain("html.sa-lens .rp .rp-chip.on{color:var(--lk-hi);font-weight:bold;");
    expect(V117).toContain("html.sa-lens .rp .rp-search input{background:var(--lk-glass);border-color:transparent;");
    expect(V117).toContain("html.sa-lens.sa-light .rp .rp-btn:not(.main),html.sa-lens.sa-light .rp .rp-chip:not(.on){color:#6B4E1A}");
    // полоски, столбики дней и пометки — прежние
    expect(code(V117)).not.toMatch(/\.rp-(bar|day|days|flags|stats)\b/);
  });
});

describe("v117: разметка «Команды и Я»", () => {
  it("аккаунт: профиль, настройки и «Карта обучения» — карточки; PIN — стекло, «Сохранить» — плашка, когда можно; «Выйти» — красная капсула", () => {
    const T = rd("ui/screens-team.jsx");
    expect(T).toContain('<div ref={acRefCard} data-lens-card="" style={{ ...T.modCard, gap:12, marginBottom:12 }}>');
    expect(T).toContain('<div data-settings="" data-lens-card="" style={{ ...T.modCard, display:"block", padding:"4px 14px", marginBottom:12 }}>');
    expect(T).toContain('<input data-lens-field="" value={pin}');
    expect(T).toContain('onClick={savePin} {...onActivate(savePin)} data-lens-btn={canSave ? "main" : "soft"}');
    expect(T).toContain('<button className="sa-btn" data-lens-btn="danger" onClick={() => setConfirmOut(true)}');
    expect(T).toContain('<button className="sa-btn" data-lens-btn="soft" onClick={() => setConfirmOut(false)}');
    expect(T).toContain('<button className="sa-btn" data-lens-btn="danger" onClick={onLogout}');
  });
  it("статистика: профиль и роли — карточки, итоги — кромка; рейтинг: лига, рекорды, люди — карточки, «Сотрудник недели» — кромка со своим градиентом", () => {
    const G = rd("ui/screens-gamification.jsx");
    expect(G).toContain('data-lens-edge="" style={{ ...T.modCard, flexDirection:"column", gap:4, padding:"12px 14px" }}>');
    expect(G).toContain('<div key={r} data-lens-card="" style={{ ...T.modCard, marginBottom:8, gap:12, opacity:');
    expect(G).toContain('data-stats-start="" className="sa-btn" onClick={onStart} data-lens-btn="main"');
    expect(G).toContain('onClick={onLeague} {...onActivate(onLeague)} className="sa-card" data-lens-card=""');
    expect(count(G, '<div data-lens-edge="" style={wrap}>')).toBe(2);
    expect(count(G, 'data-lens-card=""')).toBe(7);
  });
  it("лига: карточки, своя строка — яркий ободок (вместо своей подсветки)", () => {
    const L = rd("ui/league.jsx");
    expect(L).toContain('data-lens-card={r.me ? "hi" : ""}');
    expect(count(L, 'data-lens-card=""')).toBe(5);
  });
  it("книга отзывов: шапка — карточка, листание — линзы, пока можно листать; страницы — бумага", () => {
    const B = rd("ui/guestbook.jsx");
    expect(B).toContain('<div data-lens-card="" style={{ ...T.modCard, alignItems: "center", gap: 12 }}>');
    expect(B).toContain('data-lens={idx === 0 ? undefined : "disc"}');
    expect(B).toContain('data-lens={idx === pages.length - 1 ? undefined : "disc"}');
    expect(lineOf(B, 'className={dir === "r" ? "gb-page-r" : "gb-page-l"}')).not.toContain("data-lens");
  });
  it("сервер: карточки, «нужно сделать» — warn или ok; «Подключить бота» — плашка, остальное — стекло", () => {
    const S = rd("ui/server.jsx");
    expect(S).toContain('<div data-lens-card={rep.todo ? "warn" : "ok"} style={{ ...card, borderColor: rep.todo ? c.warn : c.ok }}');
    expect(count(S, '<div data-lens-card="" style={card}')).toBe(5);
    expect(count(S, 'data-lens-btn="soft"')).toBe(4);
    expect(S).toContain('<button type="button" data-lens-btn="main" style={btn} data-srv-tgsetup=""');
  });
  it("аналитика: карточки со своим градиентом — кромка; резервная копия — кромка, «Скачать копию» — стекло", () => {
    const A = rd("ui/screens-admin.jsx");
    expect(count(A, 'data-lens-edge="" style={G(')).toBe(9);
    expect(A).toContain('<div data-lens-edge="" style={{ ...cardBase, padding: "14px 16px", marginTop: 12 }}>');
    expect(A).toContain('<button className="sa-btn" data-lens-btn="soft" onClick={run} disabled={st === "working"}');
  });
  it("редактор уроков: поля — стекло, главные — плашки, второстепенные — стекло с подписью золотом, карточки — кромка", () => {
    const C = rd("ui/content-editor.jsx");
    expect(count(C, 'data-lens-field="" style={input}') + count(C, 'data-lens-field="" style={{ ...input,')).toBe(40);
    expect(count(C, 'data-lens-btn="main" style={{ ...primary')).toBe(11);
    expect(count(C, 'data-lens-btn="soft" data-lens-ink="" style={{ ...ghost')).toBe(6);
    expect(count(C, "data-lens-edge=\"\" style={")).toBe(22);
    // вкладки разделов редактора (столбиком) — прежние
    expect(lineOf(C, 'flex: "1 1 0", minWidth: 0, padding: "5px 0", flexDirection: "column"')).not.toContain("data-lens-btn");
  });
  it("редакторы коктейлей и меню: поля — стекло, «Сохранить» и «＋ Новый» — плашки, «Отмена» — стекло; зелёные — прежние", () => {
    const K = rd("ui/cocktail-editor.jsx"), M = rd("ui/menu-trainer.jsx");
    expect(count(K, "data-lens-field=\"\"")).toBe(12);
    expect(lineOf(K, ">＋ Новый коктейл")).toContain('data-lens-btn="main"');
    expect(lineOf(K, ">Отмена</button>")).toContain('data-lens-btn="soft"');
    expect(count(M, 'data-lens-field="" style={')).toBe(4);
    expect(lineOf(M, ">Вернуться к правке</button>")).toContain('data-lens-btn="main"');
    expect(lineOf(M, "onClick={acceptImport}")).not.toContain("data-lens");
    expect(M).toContain('data-lens-btn={(g.cat || "") === ecat ? "tab" : "soft"} data-lens-ink=""');
  });
});

describe("v117: тексты", () => {
  it("без тире-ритма и эмодзи в правилах; метка — v117 и позже", () => {
    expect(code(LOOK)).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(dashes(LOOK)).toBe(0);
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(11[7-9]|1[2-9]\d|[2-9]\d\d)<\/span>/);
  });
});
