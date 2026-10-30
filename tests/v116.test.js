// v116 (Доп. 429): «Смена» в линзах. Владелец (30.10): «Пройдёмся по приложению, добьём то, что осталось? Чтобы приложение
// визуально было едино». Чек-листы смены, SOS, меню-тренажёр и его режимы, колоды меню и бармена, «Аллергены на скорость»,
// «Как произносить», меню и карта бара для печати, «Сборка руками» и «Сборка», «Гость недели» и живой диалог, «Спасибо от
// гостей», рассадка и «Допуск наставника». Метки data-lens-* и раздел v116 в ui/home-look.jsx — всё под html.sa-lens,
// вид «как сейчас» прежний. e2e — tools/claude/e2e-v116.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const count = (s, sub) => s.split(sub).length - 1;
const LOOK = rd("ui/home-look.jsx");
const V116 = LOOK.slice(LOOK.indexOf("/* ── v116"), LOOK.lastIndexOf("`;"));
const rules = code(V116).split("}").map((r) => r.trim()).filter(Boolean);
const sels = rules.map((r) => r.split("{")[0].trim()).flatMap((s) => s.split(",").map((x) => x.trim()));
const lineOf = (src, label) => src.split("\n").find((l) => l.includes(label)) || "";

describe("v116: правила линзы (ui/home-look.jsx, раздел v116)", () => {
  it("раздел v116 после v115; каждое правило — только под html.sa-lens", () => {
    expect(LOOK.indexOf("/* ── v116")).toBeGreaterThan(LOOK.indexOf("/* ── v115"));
    expect(sels.length).toBeGreaterThan(25);
    for (const s of sels) expect(s, s).toMatch(/^html\.sa-lens(\.sa-light)?[ [:]/);
  });
  it("SOS: подпись «Назад» в линзе скрыта; строка номеров и раскрытая карточка — красная кромка и красный свет; «Для чтения» — без света", () => {
    expect(V116).toContain("html.sa-lens [data-lens-hide]{display:none}");
    // стрелка не псевдоэлементом: ::before у «назад» занят полем касания .sa-hit (44 px)
    expect(code(V116)).not.toMatch(/\[data-lens[^\]]*\]::before/);
    expect(V116).toContain('html.sa-lens [data-lens-card="sos"]{border-color:rgba(var(--lk-sos),0.55)!important;background-image:radial-gradient(120% 70px at 20% 0%,rgba(var(--lk-sos),0.10),transparent 60%)!important}');
    expect(V116).toContain('html.sa-lens.sa-light [data-lens-card="sos"]{background-image:none!important}');
    expect(V116).toContain('html.sa-lens.sa-light [data-lens="sos"]>span{color:#8A3020!important}');
  });
  it("неверный ответ «Аллергенов на скорость» — красная кромка (bad), в обеих темах", () => {
    expect(V116).toContain('html.sa-lens [data-lens-card="bad"]{border-color:rgba(224,120,120,0.7)!important}');
    expect(V116).toContain('html.sa-lens.sa-light [data-lens-card="bad"]{border-color:rgba(160,56,40,0.6)!important}');
  });
  it("приглушённая подпись на стекле — золотом (data-lens-ink), у выбранной вкладки — своя", () => {
    expect(V116).toContain('html.sa-lens [data-lens-ink]:not([data-lens-btn="tab"]){color:var(--lk-gold)!important}');
    expect(V116).toContain('html.sa-lens.sa-light [data-lens-ink]:not([data-lens-btn="tab"]){color:#6B4E1A!important}');
  });
  it("живой диалог: правила — только в оболочке .sa-dlg.dc; аватар, реплики, разбор, отзыв и бусины — без правил", () => {
    for (const s of sels.filter((x) => /\.dc-/.test(x))) expect(s, s).toMatch(/^html\.sa-lens(\.sa-light)? \.sa-dlg\.dc \.dc-/);
    expect(code(V116)).not.toMatch(/\.dc-(ava|row|b|coach|review|svc|beads|pane|q)\b/);
  });
  it("диалог: «назад», голос, звук и «вниз» — линзы с кольцом («назад» 34 px), включённый звук — ободок ярче", () => {
    expect(V116).toContain("html.sa-lens .sa-dlg.dc .dc-back{width:34px;height:34px;margin:0 3px}");
    expect(V116).toMatch(/html\.sa-lens \.sa-dlg\.dc \.dc-back,html\.sa-lens \.sa-dlg\.dc \.dc-tool,html\.sa-lens \.sa-dlg\.dc \.dc-down\{background:var\(--lk-glass\);border-color:transparent;color:var\(--lk-gold\);/);
    expect(V116).toContain('html.sa-lens .sa-dlg.dc .dc-back::after,html.sa-lens .sa-dlg.dc .dc-tool::after,html.sa-lens .sa-dlg.dc .dc-down::after{content:"";position:absolute;inset:-3.5px;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(V116).toContain("html.sa-lens .sa-dlg.dc .dc-tool.on{color:var(--lk-hi);");
    // «вниз» стоит абсолютно — своё положение ему не меняем
    const rel = rules.find((r) => r.startsWith("html.sa-lens .sa-dlg.dc .dc-back,html.sa-lens .sa-dlg.dc .dc-tool{position:relative"));
    expect(rel).toBeTruthy();
    expect(rules.filter((r) => /\.dc-down/.test(r.split("{")[0]) && /position:relative/.test(r))).toHaveLength(0);
  });
  it("диалог: карточка гостя — кромка, блик и свет; метки и ответы — стекло, выбранный ответ — прежний; «Дальше» — плашка с кольцом", () => {
    expect(V116).toMatch(/html\.sa-lens \.sa-dlg\.dc \.dc-intro,html\.sa-lens \.sa-dlg\.dc \.dc-load\{border-color:var\(--lk-edge\);background-image:radial-gradient\(/);
    expect(V116).toContain("html.sa-lens .sa-dlg.dc .dc-chip{background:var(--lk-glass);border-color:transparent;");
    expect(V116).toContain("html.sa-lens .sa-dlg.dc .dc-opt:not(.pick){background:var(--lk-glass);border-color:transparent;");
    expect(V116).toContain("html.sa-lens.sa-light .sa-dlg.dc .dc-opt:not(.pick){background:rgba(255,255,255,0.55)}");
    expect(V116).toContain("html.sa-lens .sa-dlg.dc .dc-again{background:var(--lk-glass);");
    expect(V116).toMatch(/html\.sa-lens \.sa-dlg\.dc \.dc-next\{position:relative;color:var\(--lk-hi\);background:radial-gradient\(/);
    expect(V116).toContain('html.sa-lens .sa-dlg.dc .dc-next::after{content:"";position:absolute;inset:-3.5px;border-radius:999px;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(V116).toContain("html.sa-lens.sa-light .sa-dlg.dc .dc-next{color:#6B4E1A;");
  });
});

describe("v116: разметка «Смены»", () => {
  it("чек-листы: «Править» и «Отмена» — стекло, пункты и правка — карточки, поле — стекло, «Сохранить» — плашка", () => {
    const A = rd("ui/screens-admin.jsx");
    expect(lineOf(A, "✎ Править</div>}")).toContain('data-lens-btn="soft"');
    expect(lineOf(A, ">Отмена</div>}")).toContain('data-lens-btn="soft" data-lens-ink=""');
    expect(A).toContain('<div key={it.id} data-lens-card="" style={{ ...itemCard, padding:"8px 8px 8px 12px"');
    expect(A).toContain('<input value={it.text} onChange={e=>dEdit(i,e.target.value)} placeholder="Текст пункта…" data-lens-field=""');
    expect(A).toContain('<button onClick={dAdd} data-lens-btn="soft"');
    expect(A).toContain('<button onClick={saveEdit} disabled={saving} data-lens-btn="main"');
    expect(A).toContain('<div key={it.id} onClick={()=>toggle(it.id)} {...onActivate(()=>toggle(it.id))} data-lens-card=""');
  });
  it("SOS: «назад» — линза со скрытой подписью, строка номеров и раскрытая карточка — sos", () => {
    const S = rd("ui/sos.jsx");
    // вся подпись — в одном span: отступ кнопки (gap 8) не встаёт между «‹» и «Назад», вид «как сейчас» не меняется до пикселя
    expect(S).toContain('<button className="sa-hit" style={T.backBtn} data-lens="back" aria-label="Назад" onClick={onBack} {...onActivate(onBack)}><span>‹ <span data-lens-hide="">Назад</span></span></button>');
    expect(S).toContain('<div data-lens-card="sos" style={{');
    expect(S).toContain('<div key={c.id} data-lens-card={isOpen ? "sos" : ""} style={{ ...glass(T, a11y, isOpen), overflow: "hidden" }}>');
  });
  it("меню-тренажёр: режимы — карточки, режим дня и новинки — яркий или зелёный ободок; викторина — ответы по отметке", () => {
    const M = rd("ui/menu-trainer.jsx");
    expect(M).toContain('data-lens-card={isDay ? (dayDone ? "ok" : "hi") : ""}');
    expect(M).toContain('data-lens-card={learned ? "ok" : "hi"}');
    expect(M).toContain('data-lens-opt={pick === null ? "" : i === q.correct ? "ok" : i === pick ? "bad" : ""}');
    expect(lineOf(M, ">Дальше →</button>}")).toContain('data-lens-btn="main"');
    expect(lineOf(M, ">Старт ›</button>}")).toContain('data-lens-btn="main"');
    expect(lineOf(M, ">Я закончил(а)</button>}")).not.toContain("data-lens");
    expect(count(M, 'data-lens-card=""')).toBe(9);
    expect(count(M, 'data-lens-ink=""')).toBe(5);
  });
  it("колоды меню и бармена: капсула «Колода / Знаю?», выбранная — плашка, поиск и список — линзы, карта — кромка", () => {
    const D = rd("ui/menu-deck.jsx"), C = rd("ui/cocktails.jsx");
    for (const src of [D, C]) {
      expect(src).toContain('data-lens-seg="flat"');
      expect(src).toContain('data-lens-btn={mode === "deck" ? "tab" : undefined}');
      expect(src).toContain('data-lens-btn={mode === "quiz" ? "tab" : undefined}');
      expect(count(src, "data-lens-edge=\"\"")).toBe(2);
      expect(lineOf(src, "‹ назад</button>")).toContain('data-lens-btn="soft" data-lens-ink=""');
      expect(lineOf(src, ">Знал</button>")).toContain('data-lens-btn="main"');
      expect(lineOf(src, ">Повторить</button>")).not.toContain("data-lens");
    }
    expect(D).toContain('<span style={iconBtn(open)} data-lens={open ? undefined : "disc"}');
    expect(C).toContain('onBuild(c.id); }} {...onActivate(() => onBuild(c.id))} data-lens-btn="main" style=');
    expect(C).toContain('data-lens-btn="soft" data-lens-hi={inCard(c) ? "" : undefined}');
  });
  it("«Аллергены на скорость»: карточки, неверный ответ — bad, «Поехали» и «Есть» — плашки, «Нет» и «Хватит» — стекло", () => {
    const D = rd("ui/menu-deck.jsx");
    expect(D).toContain('data-lens-card={flash ? (flash.ok ? "ok" : "bad") : ""}');
    expect(lineOf(D, ">Есть ›</button>")).toContain('data-lens-btn="main"');
    expect(lineOf(D, ">‹ Нет</button>")).toContain('data-lens-btn="soft"');
    expect(lineOf(D, ">Хватит</button>")).toContain('data-lens-btn="soft"');
    expect(lineOf(D, ">Ещё 30 секунд ›</button>")).toContain('data-lens-btn="main"');
  });
  it("«Как произносить»: поиск, разделы, слова; «послушать» — линза, пока не звучит; «ориг.» и «повторить» — стекло", () => {
    const P = rd("ui/pronounce.jsx");
    expect(P).toContain('data-lens={on || label ? undefined : "disc"} data-lens-btn={on || !label ? undefined : "soft"} data-lens-ink={on || !label ? undefined : ""}');
    expect(P).toContain('data-lens-btn={st === "rec" ? undefined : "soft"} data-lens-ink={st === "rec" ? undefined : ""}');
    expect(P).toContain('className="sa-field" data-lens-field=""');
    expect(P).toContain('data-lens-btn={!q && cat === c.id ? "tab" : "soft"} data-lens-ink=""');
    expect(P).toContain('data-pron-item="" data-lens-card=""');
  });
  it("«Сборка руками» и «Сборка»: карточки, «По памяти» — яркий ободок; ответы «Сборки» — по отметке, кнопки — плашки и стекло", () => {
    const L = rd("ui/bar-lab.jsx"), B = rd("ui/build.jsx");
    expect(L).toContain('const tile = (props, children) => <div className="sa-card" data-lens-card="" {...props} style=');
    expect(L).toContain('<div className="sa-card" data-lens-card="hi" onClick={() => startPlay(current, "memory")}');
    expect(count(L, 'data-lens-btn="main"')).toBe(3);
    expect(B).toContain('data-lens-opt={state === "win" ? "ok" : state === "lose" ? "bad" : ""}');
    expect(count(B, 'data-lens-btn="main"')).toBe(2);
    expect(count(B, 'data-lens-btn="soft"')).toBe(2);
  });
  it("печать: «Картинкой» — плашка, «Текстом» и «Печать» — стекло, «С фото» — стекло с ярким ободком", () => {
    const P = rd("ui/bar-card-print.jsx"), M = rd("ui/menu-print.jsx");
    expect(P).toContain('<button className="sa-btn" data-lens-btn="main" onClick={drawSheet}');
    expect(P).toContain('<button className="sa-btn" data-lens-btn="soft" onClick={copy}');
    expect(P).toContain('<button className="sa-btn" data-lens-btn="soft" data-lens-ink="" onClick={print}');
    expect(M).toContain('<button className="sa-btn" data-lens-btn="main" onClick={draw}');
    expect(M).toContain('<span data-lens-btn="soft" data-lens-hi={withPhoto ? "" : undefined}');
  });
  it("«Спасибо от гостей»: «Показать гостю» и «Сохранить картинку» — плашки, остальные — стекло, карточки, вкладки", () => {
    const T = rd("ui/thanks.jsx");
    expect(T).toContain('data-thanks-show="" data-lens-btn="main"');
    expect(T).toContain('data-thanks-save="" onClick={save} disabled={!prev} data-lens-btn="main"');
    expect(T).toContain('data-thanks-share="" data-lens-btn="soft"');
    expect(T).toContain('data-thanks-print="" data-lens-btn="soft" data-lens-hi={print ? "" : undefined}');
    expect(T).toContain('data-thanks-tab={k} data-lens-btn={tab === k ? "tab" : "soft"}');
    expect(count(T, 'data-lens-card=""')).toBe(7);
    // QR — бумага: тёмным по светлому, без линзы
    expect(lineOf(T, "<div data-thanks-qr=")).not.toContain("data-lens");
  });
  it("рассадка: чипсы — выбранный плашка, остальные стекло с подписью золотом; «Сохранить» — плашка; столы схемы — прежние", () => {
    const S = rd("ui/seating.jsx");
    const chips = S.split("\n").filter((l) => /chip\(c, /.test(l) && /style=/.test(l));
    expect(chips.length).toBe(16);
    for (const l of chips) expect(l).toMatch(/data-lens-btn=(\{[^}]* \? "tab" : "soft"\}|"soft") data-lens-ink=""/);
    expect(S).toContain('data-sheet-save="" onClick={() => save(st)} disabled={busy} data-lens-btn="main"');
    expect(S).toContain('data-floor-save="" onClick={save} disabled={busy} data-lens-btn="main"');
    expect(lineOf(S, "data-table={t.id}")).not.toContain("data-lens");
  });
  it("«Допуск наставника»: допуск — карточка (зелёная, когда допущен), навыки — кромка, запрос — кромка, PIN — стекло (с ошибкой — прежний)", () => {
    const M = rd("ui/mentor.jsx");
    expect(M).toContain('<div data-lens-card={allDone ? "ok" : ""} style={{ ...glass(T), margin: "14px 16px 4px", padding: "16px",');
    expect(M).toContain('<div key={s.id} className="sa-card" data-lens-edge="" style=');
    expect(M).toContain('data-lens-field={pinErr ? undefined : ""}');
    expect(M).toContain('<button className="sa-btn" data-lens-btn="main" disabled={busy} onClick={() => askHall(modal)}');
    expect(M).toContain('data-hall-inbox="" data-lens-card=""');
    // номер навыка на стекле линзы — золотом (приглушённый опускался до 4,1)
    expect(M).toContain('<div data-lens={rec ? undefined : "disc"} data-lens-ink={rec ? undefined : ""} style={{ width: 30, height: 30,');
  });
});

describe("v116: тексты", () => {
  it("без тире-ритма и эмодзи в правилах; метка — v116", () => {
    expect(code(LOOK)).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(dashes(LOOK)).toBe(0);
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v116</span>");
  });
});
