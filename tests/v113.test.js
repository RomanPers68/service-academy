// v113 (Доп. 426): линзы на экранах, которые владелец показал 30.10 — «Брифинг смены», «Случаи из нашего зала», «Живой гость»,
// «График», «Команда», AI HR («Собеседование», «Проверка AI HR»), «Глоссарий» и «Наставник». Метки data-lens-* (правила v111)
// и раздел v113 в ui/home-look.jsx — всё под html.sa-lens, вид «как сейчас» прежний. e2e — tools/claude/e2e-v113.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const count = (s, sub) => s.split(sub).length - 1;
const LOOK = rd("ui/home-look.jsx");
const V113 = LOOK.slice(LOOK.indexOf("/* ── v113"), LOOK.lastIndexOf("`;"));
const sels = code(V113).split("}").map((r) => r.split("{")[0].trim()).filter(Boolean).flatMap((s) => s.split(",").map((x) => x.trim()));
// строка исходника, где стоит подпись кнопки (кнопка целиком на одной строке)
const lineOf = (src, label) => src.split("\n").find((l) => l.includes(label)) || "";

describe("v113: правила линзы (ui/home-look.jsx, раздел v113)", () => {
  it("раздел v113 после v112; каждое правило — только под html.sa-lens", () => {
    expect(LOOK.indexOf("/* ── v113")).toBeGreaterThan(LOOK.indexOf("/* ── v112"));
    expect(sels.length).toBeGreaterThan(40);
    for (const s of sels) expect(s, s).toMatch(/^html\.sa-lens(\.sa-light)?[ [:]/);
  });
  it("«закрыть» показа брифинга — линза 32 px; кромка без света (data-lens-edge) — не трогает свой фон карточки", () => {
    expect(V113).toContain("html.sa-lens [data-lens-x]{width:32px!important;height:32px!important;min-width:32px;display:inline-grid!important;place-items:center;");
    expect(V113).toContain("html.sa-lens [data-lens-edge]{border-color:var(--lk-edge)!important;box-shadow:inset 0 1.5px 0 var(--lk-hl),inset 0 0 22px var(--lk-cglow),var(--lk-shadow)!important}");
    const edge = code(V113).split("}").filter((r) => /\[data-lens-edge\]/.test(r));
    for (const r of edge) expect(r, r).not.toMatch(/background/);
    expect(code(V113)).not.toContain('[data-lens-card="edge"]');
  });
  it("вкладки: капсула с ободком (data-lens-seg), кольцо — только у \"\" (не у «flat»); выбранная — плашка с золотым ободком", () => {
    expect(V113).toContain("html.sa-lens [data-lens-seg]{position:relative;border-color:transparent!important;box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 1.5px 0 var(--lk-hl)!important}");
    expect(V113).toContain('html.sa-lens [data-lens-seg=""]::after{content:"";position:absolute;inset:-3.5px;border-radius:999px;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(V113).toMatch(/html\.sa-lens \[data-lens-btn="tab"\]\{color:var\(--lk-hi\)!important;font-weight:bold!important;background:radial-gradient\([^}]*inset 0 0 0 1px rgba\(232,201,131,0\.62\)/);
    expect(V113).toContain('html.sa-lens.sa-light [data-lens-btn="tab"]{');
  });
  it("«Для чтения»: надписи стекла и выбранных вкладок — тёмным золотом #6B4E1A; «Ещё» графика — золотом (контраст 4,5)", () => {
    expect(V113).toContain('html.sa-lens.sa-light [data-lens-btn="soft"]{color:#6B4E1A!important}');
    expect(V113).toContain('html.sa-lens.sa-light [data-lens-btn="tab"]{color:#6B4E1A!important;background:');
    expect(V113).toContain("html.sa-lens [data-sched-more]{color:var(--lk-gold)!important}");
    expect(rd("ui/schedule.jsx")).toContain('<button data-lens-btn="soft" data-sched-more="" data-lens-hi={more ? "" : undefined} style=');
  });
  it("разделы и номера шагов графика: .sa-schedsec — кромка, .sa-schedno — линза с кольцом", () => {
    expect(V113).toContain("html.sa-lens .sa-schedsec{border-color:var(--lk-edge)!important;");
    expect(V113).toContain('html.sa-lens .sa-schedno::after{content:"";position:absolute;inset:-3.5px;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}');
  });
  it("кнопка-волна «Разговор голосом» — золотая линза везде (гость, Наставник, AI-интервью), не только у гостя", () => {
    expect(V113).toContain("html.sa-lens [data-talk-open]{position:relative;color:var(--lk-hi)!important;background:radial-gradient(circle at 50% 28%,rgba(240,214,150,0.38),");
    expect(V113).toContain('html.sa-lens [data-talk-open]::after{content:"";position:absolute;inset:-3.5px;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(V113).toContain("html.sa-lens.sa-light [data-talk-open]{");
    expect(code(V113)).not.toContain(".tb-guest [data-talk-open]");
    // кнопка одна на всех: ui/talk.jsx
    expect(rd("ui/talk.jsx")).toContain('<button type="button" className="sa-btn" data-talk-open="" onClick={tap}');
  });
  it("поле-строка Наставника: ободок ярче, пока пишешь (:focus-within)", () => {
    expect(V113).toContain("html.sa-lens [data-lens-field]:focus-within{box-shadow:inset 0 0 0 1px var(--lk-hi),inset 0 0 14px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl)!important}");
  });
  it("«Живой гость» — правила только в .tb-guest: «закрыть», значок, звук, «сказать» — линзы; поле — стекло; реплики — ободок", () => {
    expect(V113).toContain("html.sa-lens .tb-guest .tb-x,html.sa-lens .tb-guest .tb-av,html.sa-lens .tb-guest .tb-tool,html.sa-lens .tb-guest .lg-send{position:relative;background:var(--lk-glass);");
    expect(V113).toContain("html.sa-lens .tb-guest .tb-main:not(:disabled){position:relative;overflow:visible;color:var(--lk-hi);");
    expect(V113).toContain("html.sa-lens .tb-guest .lg-in,html.sa-lens .tb-guest .lg-ed input,html.sa-lens .tb-guest .lg-ed textarea{background:var(--lk-glass);");
    expect(sels.some((s) => /\.tb-radio/.test(s))).toBe(false);
    // урок у стола и гость по сценарию — та же оболочка .tb без класса: правил v113 для «.tb » без .tb-guest нет
    expect(sels.filter((s) => /\.tb[ .:]/.test(s) && !/\.tb-guest/.test(s))).toEqual([]);
  });
});

describe("v113: «Живой гость» — своя оболочка .tb-guest", () => {
  it("все четыре экрана гостя — shell(…, \"tb-guest\"); урок у стола и радио — без него", async () => {
    const G = rd("ui/live-guest.jsx");
    expect(count(G, ', vars, inline, "tb-guest");')).toBe(4);
    expect(G).not.toMatch(/, vars, inline\);/);
    for (const f of ["ui/table.jsx", "ui/radio.jsx"]) expect(code(rd(f)), f).not.toContain("tb-guest");
    const { tableShell } = await import("../ui/table.jsx");
    expect(renderToString(tableShell(React.createElement("i"), {}, true, "tb-guest"))).toMatch(/^<div class="tb tb-guest"/);
  });
  it("микрофон — тонкое кольцо, пока не пишет (во время записи — своё кольцо-таймер)", () => {
    expect(rd("ui/mic.jsx")).toContain('data-lens={rec ? undefined : "mic"}');
  });
});

describe("v113: «Брифинг смены» и «Случаи из нашего зала»", () => {
  const B = rd("ui/briefing.jsx"), C = rd("ui/cases.jsx");
  it("брифинг: блоки — карточки; «Отправить команде», «Дальше», «Прочитал(а)» — плашки; «Провести», «Назад», «Показать ответ» — стекло", () => {
    expect(count(B, 'data-lens-card=""')).toBe(5);
    expect(count(B, 'data-lens-btn="main"')).toBe(5);
    expect(count(B, 'data-lens-btn="soft"')).toBe(4);
    expect(B).toContain('<button type="button" data-brief-publish="" data-lens-btn="main" onClick={publish}');
    expect(B).toContain('<button type="button" data-brief-present="" data-lens-btn="soft" onClick=');
    expect(B).toContain('? <button type="button" data-brief-read="" data-lens-btn="main" onClick={read}');
    expect(B).toContain('<textarea data-lens-field="" value={note}');
  });
  it("показ брифинга: «закрыть» — линза 32 px (data-lens-x)", () => {
    expect(B).toContain('<button type="button" data-sa-back="" data-lens="disc" data-lens-x="" aria-label="Закрыть" onClick={onClose}');
  });
  it("случаи: поля — стекло, карточки, «Опубликовать», «Отправить», «Разыграть» — плашки, «Разобрать с ИИ», «Рассказать» — стекло", () => {
    expect(count(C, 'data-lens-field=""')).toBe(2);
    expect(count(C, 'data-lens-card=""')).toBe(10);
    for (const k of ["data-case-publish", "data-case-decline-send", "data-case-send", "data-case-play"]) expect(C).toContain(k + '="" data-lens-btn="main"');
    for (const k of ["data-case-ai-go", "data-case-decline", "data-case-tell-open"]) expect(C).toContain(k + '="" data-lens-btn="soft"');
  });
  it("случаи: «Удалить», переключатели и итог разбора — прежние", () => {
    for (const k of ["data-case-delete", "data-case-toggle", "data-case-outcome"]) expect(lineOf(C, k), k).not.toContain("data-lens");
  });
});

describe("v113: «График»", () => {
  const S = rd("ui/schedule.jsx"), H = rd("ui/schedule-hero.jsx");
  it("вкладки «График / Настройки» — капсула с кольцом, «неделя / месяц» и «месяц / списком» — без кольца; выбранная — плашка", () => {
    expect(S).toContain('<div data-sched-tabs="" data-lens-seg="" style=');
    expect(S).toContain('data-lens-btn={tab === k ? "tab" : undefined}');
    expect(S).toContain('data-sched-weekmode="" data-lens-seg="flat"');
    expect(S).toContain('data-lens-btn={onB ? "tab" : undefined}');
    expect(S).toContain('<span data-sched-viewtoggle="" data-lens-seg="flat" style=');
    expect(S).toContain('data-lens-btn={calView === kv ? "tab" : undefined}');
  });
  it("карточки — кромка без света (15), кнопки — плашки и стекло; поля настроек — стекло", () => {
    expect(count(S, 'data-lens-edge=""')).toBe(15);
    expect(count(S, 'data-lens-btn="main"')).toBe(10);
    expect(count(S, 'data-lens-btn="soft"')).toBe(53);
    expect(count(S, 'data-lens-field=""')).toBe(3);
    expect(count(S, 'data-lens="disc"')).toBe(4);
  });
  it("у сотрудника: «Забрать», «Выйду», «Отдать в чате» — плашки; «Поменяться», «В чат» — стекло; «Отметить период» — стекло, при отметке ярче", () => {
    expect(S).toContain('data-sched-chat-take={r.msg} data-lens-btn="main" onClick=');
    expect(S).toContain('data-sched-chat-give={dSel} data-lens-btn="main" onClick=');
    expect(S).toContain('data-sched-chat-swap={r.msg} data-lens-btn="soft" onClick=');
    expect(S).toContain('data-sched-chat-swapgo={dSel} data-lens-btn="soft" onClick=');
    expect(count(S, 'data-lens-btn="soft" data-lens-hi={wishRange ? "" : undefined}')).toBe(2);
  });
  it("кнопки с предупреждением и удалением — прежние", () => {
    for (const t of [">Очистить месяц</button>", ">Стереть весь месяц</button>"]) expect(lineOf(S, t), t).not.toContain("data-lens");
  });
  it("карточка ближайшей смены и итоги месяца — кромка; «Чек-лист смены» — плашка, «Кто со мной», «Повторить» — стекло", async () => {
    expect(count(H, 'data-lens-edge=""')).toBe(3);
    const { ShiftHero } = await import("../ui/schedule-hero");
    const html = renderToString(React.createElement(ShiftHero, { a11y: false, card: { margin: 14 }, d: 17, sh: { k: "В", name: "Вечер", from: 16, to: 24 }, when: "сегодня",
      dowName: "суббота", dowShort: "сб", monthR: "октября", isToday: true, now: new Date(2026, 9, 17, 14, 20), lead: "Смирнов Роман", mates: 3, onMates: () => {}, onChecklist: () => {},
      due: { n: 2, onMistakes: () => {} } }));
    expect(html).toContain('data-hero-status="soon" data-lens-edge=""');
    expect(html).toContain('data-hero-checklist="" data-lens-btn="main"');
    expect(html).toContain('data-hero-mates="" data-lens-btn="soft"');
    expect(html).toMatch(/data-lens-btn="soft" style="[^"]*"[^>]*>Повторить перед сменой</);
  });
});

describe("v113: «Команда»", () => {
  const T = rd("ui/screens-team.jsx");
  it("список: «+ Добавить» — плашка, «Собеседование кандидата» и люди — карточки, итоги — кромка, поиск — стекло", () => {
    expect(T).toContain('<button className="sa-btn" data-lens-btn="main" onClick={() => { setActionError(null); setView("add"); }}');
    expect(T).toContain('<button className="sa-btn" data-lens-card="" onClick={() => { vibrate("light"); onCandidate(); }}');
    expect(T).toContain('<div key={i} data-lens-edge="" style={{ flex:1, minWidth:88');
    expect(T).toContain('<input data-lens-field="" style={{ ...inputStyle, marginBottom:16 }} placeholder="Поиск по имени или ресторану..."');
    expect(T).toContain('<div key={e.id} className="sa-btn" data-lens-card="" onClick=');
  });
  it("карточка сотрудника: аватар с кольцом, «Сбросить код», «Выдать», «Сохранить» — плашки, «Изменить», «Отмена» — стекло", () => {
    expect(T).toContain('<div data-lens="avatar" style={{ width:50, height:50, borderRadius:"50%"');
    expect(T).toContain('<button className="sa-btn" data-lens-btn="main" style={goldBtn} onClick={() => setConfirm("reset")}>');
    expect(T).toContain('<button className="sa-btn" data-lens-btn="main" style={{ ...goldBtn, flex:1 }} disabled={busy} onClick={doReset}>');
    expect(T).toContain('<button className="sa-btn" data-lens-btn="main" disabled={busy} onClick={doRename}');
    expect(count(T, '<button className="sa-btn" data-lens-btn="soft" style={{ ...ghostBtn, flex:1 }} onClick={() => setConfirm(null)}>Отмена</button>')).toBe(4);
    expect(T).toContain('<div data-lens-card="hi" onClick={() => copyCode(issued.code)}');
  });
  it("красные «Отключить», «Удалить» — прежнего цвета, только капсулой (data-lens-btn=\"danger\": правил, кроме скругления, нет)", () => {
    expect(count(T, 'data-lens-btn="danger"')).toBe(6);   // v117: и «Выйти с этого устройства», «Выйти» в аккаунте
    expect(LOOK).not.toMatch(/\[data-lens-btn="danger"\]/);
    expect(LOOK).toContain("html.sa-lens [data-lens-btn]{border-radius:999px!important}");
  });
  it("должность в списке и карточке — общим словарём (владелец — «Владелец», а не owner)", async () => {
    expect(T).toContain("{positionLabel(e.position)} · {ago(e.last_seen_at)}");
    expect(T).toContain("{selected.restaurant} · {positionLabel(selected.position)}");
    expect(T).not.toContain("POS_LABELS[e.position] ||");
    const { positionLabel } = await import("../data/positions.js");
    expect(positionLabel("owner")).toBe("Владелец");
  });
});

describe("v113: AI HR («Собеседование», «Проверка AI HR»)", () => {
  const C = rd("ui/candidate.jsx"), H = rd("ui/hr-eval.jsx");
  it("главная: «Начать собеседование» — плашка; строка AI HR и история — карточки", () => {
    expect(C).toContain('<button className="sa-btn" data-lens-btn="main" style={goldBtn} onClick={startSetup}>Начать собеседование</button>');
    expect(C).toContain('<div className="sa-btn" data-lens-card="" data-hr-row={hrSt.beta ? "beta" : "ok"}');
    expect(C).toContain('data-cand-row={r.id} data-lens-card=""');
  });
  it("выбранная роль и опыт — карточка «hi»; «Вопросы твоего ресторана» включены — плашка", () => {
    expect(C).toContain('data-lens-card={role.id === rl.id ? "hi" : ""}');
    expect(C).toContain('data-lens-card={exp?.id === x.id ? "hi" : ""}');
    expect(C).toContain('data-lens-btn={useCustom ? "tab" : "soft"}');
  });
  it("AI-интервью: лента — кромка, поле ответа — стекло, «Повторить», «Завершить раньше» — стекло, «Завершить интервью» — плашка", () => {
    expect(C).toContain('<div ref={aiListRef} className="sa-dlgscroll" data-lens-edge=""');
    expect(C).toMatch(/ref=\{aiInputRef\}\s+data-lens-field=""/);
    expect(C).toContain('<button className="sa-btn" data-lens-btn="soft" data-hr-retry=""');
    expect(C).toContain('<button className="sa-btn" data-lens-btn="soft" data-hr-early="" onClick={finishAi}');
    expect(C).toContain('<button className="sa-btn" data-lens-btn="main" style={goldBtn} onClick={finishAi}>');
  });
  it("отчёт ИИ: отдельный — карточки линзы (и «Ваше решение»), в строке истории — без них", () => {
    expect(C).toContain('const lensBox = compact ? {} : { "data-lens-card": "" };');
    expect(count(C, "{...lensBox}")).toBe(4);
    expect(C).toContain("<Decision rec={rec} onDecide={onDecide} sub={sub} T={T} style={box} lens={!compact} />");
    expect(C).toContain('<div style={style} data-ai-decision={rec.decision || ""} data-lens-card={lens ? "" : undefined}>');
  });
  it("ответы теста и решения «Берём / Не берём» — прежние; красные «Прервать», «Удалить запись» — капсулой", () => {
    for (const l of C.split("\n").filter((x) => x.includes('className="sa-btn sa-opt"'))) expect(l).not.toContain("data-lens");
    expect(lineOf(C, "data-decide={d.id}")).not.toContain("data-lens");
    expect(count(C, 'data-lens-btn="danger"')).toBe(2);
  });
  it("«Проверка AI HR»: условия, запуск и эталоны — карточки; «Запустить проверку» — плашка, «Остановить» — стекло", () => {
    expect(count(H, 'data-lens-card=""')).toBe(3);
    expect(H).toContain('<button className="sa-btn" data-lens-btn="main" style={goldBtn} onClick={start} data-hr-eval-start="">');
    expect(H).toContain('<button className="sa-btn" data-lens-btn="soft" style={ghostBtn} onClick={stop} data-hr-eval-stop="">');
  });
});

describe("v113: «Глоссарий» и «Наставник»", () => {
  const L = rd("ui/screens-learning.jsx"), A = rd("ui/assistant.jsx");
  const G = L.slice(L.indexOf("export function GlossaryScreen"));
  it("глоссарий: поиск и заметка — стекло, термины — карточки, «Только избранное» — стекло, включено — плашка; звёздочка — прежняя", () => {
    expect(G).toMatch(/placeholder="Поиск термина\.\.\."\s+data-lens-field=""/);
    expect(G).toContain('placeholder="Моя заметка..." rows={2} data-lens-field=""');
    expect(G).toContain('<div key={"t" + i} data-lens-card="" style={{ ...T.modCard');
    expect(G).toContain('aria-pressed={favOnly} data-lens-btn={favOnly ? "tab" : "soft"}');
    expect(lineOf(G, "onClick={() => onToggleFav(k)}")).not.toContain("data-lens");
  });
  it("Наставник: кнопки шапки и значок AI — линзы, вступление и готовые вопросы — карточки, строка ввода — стекло", () => {
    expect(count(A, '<button className="sa-btn" data-lens="disc" style={miniBtn}')).toBe(3);
    expect(A).toContain('<div className="sa-pop" data-lens="disc" style={{ width: 54, height: 54');
    expect(A).toContain('<div className="sa-pagein" data-lens-card="" style={{ ...glass, padding: "20px 18px" }}>');
    expect(A).toContain('<button key={i} className="sa-btn sa-pagein" data-lens-card="" onClick={() => send(q)}');
    expect(A).toContain('<div data-lens-field="" style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "6px 6px 6px 16px", borderRadius: 28,');
    expect(A).toContain('<button className="sa-btn" data-lens-btn="danger" onClick={clearChat}');
  });
  it("Наставник: пузыри переписки — прежние", () => {
    for (const l of A.split("\n").filter((x) => x.includes('className="dlg-in"'))) expect(l).not.toContain("data-lens");
  });
});

describe("v113: демо и тексты", () => {
  it("демо: у владельца в «Команде» — список (admin_list_employees), у остальных — отказ", async () => {
    const F = rd("tools/claude/demo-app/fake-server.js");
    expect(F).toContain('if (fn === "admin_list_employees") {');
    expect(F).toContain('if (!p || !p.is_admin) return { ok: false, error: "forbidden" };');
  });
  it("без тире-ритма и эмодзи в правилах; метка — v113", () => {
    expect(code(LOOK)).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(dashes(LOOK)).toBe(0);
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(11[3-9]|1[2-9]\d|[2-9]\d\d)<\/span>/);   // v113 и позже
  });
});
