// v115 (Доп. 428): «Учусь» в линзах. Владелец (30.10): «Пройдёмся по приложению, добьём то, что осталось? Чтобы приложение
// визуально было едино». Практика у стола, проверка ситуаций и «Чек недели» (своя оболочка .tb-table), трек, тест и «Работа
// над ошибками», «Погреб тем», «Путь мастера», сертификаты, путеводитель, поиск и «Справочник». Метки data-lens-* (правила
// v111) и раздел v115 в ui/home-look.jsx — всё под html.sa-lens, вид «как сейчас» прежний. e2e — tools/claude/e2e-v115.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const count = (s, sub) => s.split(sub).length - 1;
const LOOK = rd("ui/home-look.jsx");
const V115 = LOOK.slice(LOOK.indexOf("/* ── v115"), LOOK.lastIndexOf("`;"));
const rules = code(V115).split("}").map((r) => r.trim()).filter(Boolean);
const sels = rules.map((r) => r.split("{")[0].trim()).flatMap((s) => s.split(",").map((x) => x.trim()));
// строка исходника, где стоит подпись кнопки (кнопка целиком на одной строке)
const lineOf = (src, label) => src.split("\n").find((l) => l.includes(label)) || "";

describe("v115: правила линзы (ui/home-look.jsx, раздел v115)", () => {
  it("раздел v115 после v113, в конце набора правил; каждое правило — только под html.sa-lens", () => {
    expect(LOOK.indexOf("/* ── v115")).toBeGreaterThan(LOOK.indexOf("/* ── v113"));
    expect(sels.length).toBeGreaterThan(20);
    for (const s of sels) expect(s, s).toMatch(/^html\.sa-lens(\.sa-light)?[ [:]/);
  });
  it("урок у стола: правила кнопок — только в оболочке .tb-table («Живой гость» и радио не задеты)", () => {
    for (const s of sels.filter((x) => /\.tb-/.test(x) && !/\.tbm-cta/.test(x))) expect(s, s).toMatch(/^html\.sa-lens(\.sa-light)? \.tb-table /);
    expect(code(V115)).not.toMatch(/\.tb-guest|\.tb-radio/);
  });
  it("«закрыть», значок и инструменты — линзы с кольцом; инструменты круглые, включённый — ободок ярче; «Для чтения» — тёмное золото", () => {
    expect(V115).toContain("html.sa-lens .tb-table .tb-x,html.sa-lens .tb-table .tb-av,html.sa-lens .tb-table .tb-tool{position:relative;background:var(--lk-glass);border-color:transparent;color:var(--lk-gold);");
    expect(V115).toContain("html.sa-lens .tb-table .tb-tool{border-radius:50%}");
    expect(V115).toContain("html.sa-lens .tb-table .tb-tool.on{color:var(--lk-hi);box-shadow:inset 0 0 0 1px var(--lk-hi),");
    expect(V115).toContain('html.sa-lens .tb-table .tb-x::after,html.sa-lens .tb-table .tb-av::after,html.sa-lens .tb-table .tb-tool::after{content:"";position:absolute;inset:-3.5px;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(V115).toContain("html.sa-lens.sa-light .tb-table .tb-x,html.sa-lens.sa-light .tb-table .tb-av,html.sa-lens.sa-light .tb-table .tb-tool{color:#6B4E1A}");
  });
  it("«Дальше» и «К итогам» — плашка с кольцом, только пока кнопка доступна; полоска автоперехода — по форме плашки", () => {
    const main = rules.filter((r) => /\.tb-main/.test(r.split("{")[0]));
    expect(main.length).toBe(5);
    for (const r of main.filter((x) => !/>\.auto/.test(x))) expect(r, r).toContain(".tb-main:not(:disabled)");
    expect(V115).toMatch(/html\.sa-lens \.tb-table \.tb-main:not\(:disabled\)\{position:relative;overflow:visible;color:var\(--lk-hi\);background:radial-gradient\(/);
    expect(V115).toContain('html.sa-lens .tb-table .tb-main:not(:disabled)::after{content:"";position:absolute;inset:-3.5px;border-radius:999px;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(V115).toContain("html.sa-lens.sa-light .tb-table .tb-main:not(:disabled){color:#6B4E1A;");
    expect(V115).toContain("html.sa-lens .tb-table .tb-main>.auto{border-radius:inherit}");
  });
  it("ответы — стекло с ободком и бликом; верный и неверный «правда / миф» — прежние; «скажи» — прежний пунктир цветом ободка", () => {
    expect(V115).toContain("html.sa-lens .tb-table .tb-chip2,html.sa-lens .tb-table .tb-actc,html.sa-lens .tb-table .tb-myth button:not(.right):not(.wrong){background:var(--lk-glass);border-color:transparent;");
    expect(V115).toContain("html.sa-lens .tb-table .tb-reply{border-color:var(--lk-rim);box-shadow:inset 0 1.5px 0 var(--lk-hl)}");
    const reply = rules.find((r) => r.startsWith("html.sa-lens .tb-table .tb-reply{"));
    expect(reply).not.toMatch(/background|border-style|border:/);
    for (const s of sels.filter((x) => /\.tb-myth/.test(x))) expect(s).toContain(":not(.right):not(.wrong)");
  });
  it("метки ситуации — стекло, «Для чтения» — тёмное золото", () => {
    expect(V115).toContain("html.sa-lens .tb-table .tb-chip{background:var(--lk-glass);border-color:transparent;box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 1px 0 var(--lk-hl)}");
    expect(V115).toContain("html.sa-lens.sa-light .tb-table .tb-chip{color:#6B4E1A}");
  });
  it("карточка ситуации, тарелки, бусины, звёзды и полоса таймера — без правил линзы", () => {
    expect(code(V115)).not.toMatch(/\.tb-(card|sit|plate|beads|stars|timer|claim|paper)\b/);
  });
  it("трек: «Дальше» и «Начать» текущего шага — плашка с кольцом; «Для чтения» — светлая плашка, тёмное золото", () => {
    expect(rd("ui/module-menu.jsx")).toContain('<span className="tbm-cta">{started ? "Дальше" : "Начать"}</span>');
    expect(V115).toMatch(/html\.sa-lens \.tbm-cta\{position:relative;color:var\(--lk-hi\);background:radial-gradient\(/);
    expect(V115).toContain('html.sa-lens .tbm-cta::after{content:"";position:absolute;inset:-3.5px;border-radius:999px;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(V115).toContain("html.sa-lens.sa-light .tbm-cta{color:#6B4E1A;background:radial-gradient(120% 160% at 50% 0%,rgba(255,255,255,0.85),");
    expect(V115).toContain("html.sa-lens.sa-light .tbm-cta::after{border-color:rgba(139,106,48,0.45)}");
  });
  it("ответы теста: стекло только у ответа без отметки (data-lens-opt=\"\"); «Для чтения» — светлое стекло", () => {
    expect(V115).toContain('html.sa-lens [data-lens-opt=""]{background:var(--lk-glass)!important;border-color:transparent!important;box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 1.5px 0 var(--lk-hl)!important}');
    expect(V115).toContain('html.sa-lens.sa-light [data-lens-opt=""]{background:rgba(255,255,255,0.55)!important}');
    expect(code(LOOK)).not.toMatch(/\[data-lens-opt="(ok|bad)"\]|\[data-lens-opt\]/);
  });
});

describe("v115: разметка «Учусь»", () => {
  const TB = rd("ui/table.jsx");
  it("урок у стола, проверка ситуаций и «Чек недели» — оболочка tb-table (все 8 вызовов shell)", () => {
    expect(TB).toContain('function shell(children, vars, inline, cls = "") {');
    expect(count(TB, "shell(") - 1).toBe(8);
    expect(count(TB, ', "tb-table");')).toBe(8);
    expect(TB).toContain('</>, roleVars("#C8A96E", a11y), inline, "tb-table");');
    expect(count(rd("ui/live-guest.jsx"), ', "tb-guest");')).toBe(4);
    expect(count(rd("ui/radio.jsx"), ', "tb-radio");')).toBe(2);
  });
  it("тест: метка ответа — по отметке (ok, bad или пусто); «Работа над ошибками» — так же", () => {
    const L = rd("ui/screens-learning.jsx");
    expect(L).toContain('const mark = reveal === null ? null : i === q.correct ? "ok" : i === reveal ? "bad" : null;');
    expect(L).toContain('<div key={i} className="sa-opt" data-quiz-opt={i} data-lens-opt={mark || ""} style={st}');
    expect(L).toContain('<div key={i} className="sa-opt" data-lens-opt={pick === null ? "" : i === q.correct ? "ok" : i === pick ? "bad" : ""} style={st}');
  });
  it("правило зачёта теста — кромка", () => {
    expect(rd("ui/quiz-bits.jsx")).toContain('<div data-quiz-rule role="note" data-lens-edge="" style={{');
  });
  it("«Погреб тем»: сводка — карточка, плитки — кромка, «Освежить» — плашка, «Проверка по треку» — стекло, фильтр — вкладка", () => {
    const C = rd("ui/cellar.jsx");
    expect(C).toContain('<div style={card} role="group" aria-label="Сводка" data-lens-card="">');
    expect(C).toContain('<div key={k} data-lens-edge="" style={{ textAlign: "center",');
    expect(lineOf(C, ">Освежить всё выдохшееся · ")).toContain('data-lens-btn="main" style={btn(true)}');
    expect(lineOf(C, ">Проверка по треку · ")).toContain('data-lens-btn="soft" style={btn(false)}');
    expect(C).toContain('aria-pressed={filter === id} data-lens-btn={filter === id ? "tab" : "soft"}');
    expect(C).toContain('<div key={r.m.id} role="listitem" className="sa-card" data-lens-card=""');
    expect(C).toContain('data-cellar-action="" data-lens-btn={a.primary ? "main" : "soft"} style={rowBtn(a.primary)}');
  });
  it("«Путь мастера»: главная награда — кромка (свой градиент остаётся), шаги — карточки, значки — линзы, кнопки — плашки и стекло", () => {
    const M = rd("ui/mastery.jsx");
    expect(M).toContain('<section data-ms-hero="" aria-label="Мастер роли" data-lens-edge="" style={card(a11y, true)}>');
    expect(M).toContain('<section data-ms-step="" aria-label="Шаг дня" data-lens-card="" style={card(a11y, false)}>');
    expect(count(M, 'data-lens-btn="main"')).toBe(5);
    expect(count(M, 'data-lens-btn="soft"')).toBe(2);
    expect(count(M, 'data-lens-card=""')).toBe(4);
    expect(count(M, 'data-lens="glyph"')).toBe(2);
    expect(lineOf(M, "Сделать ›</button>")).toContain('data-lens-btn="main"');
    expect(lineOf(M, "Убрать приз</button>")).toContain('data-lens-btn="soft"');
  });
  it("сертификаты: карточки; «Пересдать» — красная капсула, сертификат — стекло, экзамен — плашка", () => {
    const E = rd("ui/screens-exam.jsx");
    expect(E).toContain('<div key={id} data-lens-card="" style={{ ...T.modCard, padding:"14px 16px"');
    expect(count(E, 'data-lens-btn="danger"')).toBe(1);
    expect(count(E, 'data-lens-btn="soft"')).toBe(1);
    expect(count(E, 'data-lens-btn="main"')).toBe(1);
  });
  it("путеводитель: пункты и «Показать подсказки заново» — карточки, «Открыть ›» — стекло", () => {
    const G = rd("ui/guide.jsx");
    expect(G).toContain('<div data-lens-card="" onClick={() => { const n = resetHints();');
    expect(G).toContain('<div key={it.key} data-lens-card="" style={{ ...frost, borderRadius: 14, overflow: "hidden" }}>');
    expect(G).toContain('<button className="sa-btn" data-lens-btn="soft" onClick={() => { vibrate("light"); onOpen(it.go); }}');
  });
  it("поиск и поиск по «Справочнику» — стекло", () => {
    expect(rd("ui/ReferenceSection.jsx")).toContain('role="search" aria-label="Поиск по справочнику" data-lens-field=""');
    expect(count(rd("ui/search.jsx"), 'data-lens-field=""')).toBe(1);
  });
});

describe("v115: тексты", () => {
  it("без тире-ритма и эмодзи в правилах; метка — v115", () => {
    expect(code(LOOK)).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(dashes(LOOK)).toBe(0);
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v115</span>");
  });
});
