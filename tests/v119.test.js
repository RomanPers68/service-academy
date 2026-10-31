// v119 (Доп. 432): то, что всплывает по событию и потому не попадало в демо, в линзах. Владелец (31.10, снимки): «Двоих
// поймал, без эффекта линзы» (новый значок и баннер книги отзывов), потом «Ну и ещё троих» (полоска номеров тем, поиск и
// «Сменить» в шапке трека, вид «списком»). Того же рода: «Мастер роли», «Готова новая версия», «Итоги месяца», «Вопрос
// дня», «Смены в календаре телефона», подсказки, голос шефа и сомелье, «Работа над ошибками» на треке. Метки data-lens-*
// и раздел v119 в ui/home-look.jsx — всё под html.sa-lens, вид «как сейчас» прежний. e2e — tools/claude/e2e-v119.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const count = (s, sub) => s.split(sub).length - 1;
const LOOK = rd("ui/home-look.jsx");
const V119 = LOOK.slice(LOOK.indexOf("/* ── v119"), LOOK.lastIndexOf("`;"));
const rules = code(V119).split("}").map((r) => r.trim()).filter(Boolean);
const sels = rules.map((r) => r.split("{")[0].trim()).flatMap((s) => s.split(",").map((x) => x.trim()));
const lineOf = (src, label) => src.split("\n").find((l) => l.includes(label)) || "";

describe("v119: правила линзы (ui/home-look.jsx, раздел v119)", () => {
  it("раздел v119 — последний, после v117; каждое правило — только под html.sa-lens", () => {
    expect(LOOK.indexOf("/* ── v119")).toBeGreaterThan(LOOK.indexOf("/* ── v117"));
    expect(LOOK.indexOf("/* ── v", LOOK.indexOf("/* ── v119") + 5)).toBe(-1);
    expect(sels.length).toBeGreaterThan(12);
    for (const s of sels) expect(s, s).toMatch(/^html\.sa-lens(\.sa-light)?[ [.]/);
  });
  it("всплывающее парит: тень глубже, чем у карточек на экране, в обеих темах", () => {
    expect(V119).toContain("html.sa-lens [data-lens-float]{box-shadow:inset 0 1.5px 0 var(--lk-hl),inset 0 0 22px var(--lk-cglow),0 14px 36px rgba(0,0,0,0.55)!important}");
    expect(V119).toContain("html.sa-lens.sa-light [data-lens-float]{box-shadow:inset 0 1.5px 0 var(--lk-hl),inset 0 0 22px var(--lk-cglow),0 12px 30px rgba(110,80,25,0.22)!important}");
  });
  it("новый значок: под светом линзы — сплошной тон прежнего цвета (тёмный и светлый); «закрыть» — 8 px от края", () => {
    expect(V119).toContain("html.sa-lens .ms-toast[data-lens-card]{background-color:#271D0F!important}");
    expect(V119).toContain("html.sa-lens.sa-light .ms-toast[data-lens-card]{background-color:#FAF1DE!important}");
    expect(V119).toContain("html.sa-lens .ms-toast [data-lens-x]{top:8px!important;right:8px!important}");
  });
  it("баннер книги: стекло с размытием, крестик прежнего размера", () => {
    expect(V119).toContain("html.sa-lens .sa-bookbanner[data-lens-card]{-webkit-backdrop-filter:blur(14px) saturate(140%);backdrop-filter:blur(14px) saturate(140%)}");
    expect(V119).toContain("html.sa-lens .sa-bookbanner [data-lens-x]{font-size:13px!important}");
  });
  it("голоса: значки на плашках — цветом подписи", () => {
    expect(V119).toContain('html.sa-lens [data-voices-all][data-lens-btn="main"] path,html.sa-lens [data-voices-pause] path{fill:currentColor}');
  });
  it("полоска номеров тем: капсула — стекло; «монета» — плотная плашка с ярким ободком; цифры — золотом", () => {
    expect(V119).toMatch(/html\.sa-lens \.tbp-cap\{background:var\(--lk-glass\);border-color:transparent;box-shadow:inset 0 0 0 1px var\(--lk-rim\)/);
    expect(V119).toMatch(/html\.sa-lens\.sa-light \.tbp-cap\{background:rgba\(255,255,255,0\.55\)/);
    expect(V119).toMatch(/html\.sa-lens \.tbp-ind\{background:radial-gradient\([^;]*\),#2B2112;/);
    expect(V119).toMatch(/html\.sa-lens\.sa-light \.tbp-ind\{background:radial-gradient\([^;]*\),#F4EAD3;/);
    expect(V119).toContain("html.sa-lens .tbp-ind-row span{color:var(--lk-hi)}");
    expect(V119).toContain("html.sa-lens.sa-light .tbp-ind-row span{color:#6B4E1A}");
    // светлые правила сильнее прежних html.sa-light .tbp-… (те встают позже, с table-css)
    for (const s of sels.filter((x) => /\.tbp-/.test(x) && /sa-light/.test(x))) expect(s).toMatch(/^html\.sa-lens\.sa-light /);
  });
});

describe("v119: разметка", () => {
  it("новый значок и «Мастер роли» (ui/mastery-card.jsx)", () => {
    const M = rd("ui/mastery-card.jsx");
    expect(M).toContain('<div className="ms-toast" role="status" aria-live="polite" data-lens-card="" data-lens-float="" onPointerDown={down}');
    expect(lineOf(M, ">Путь мастера ›</button>")).toContain("width: \"100%\", minHeight: 44");
    expect(M).toContain('<button type="button" className="sa-btn" data-lens-btn="main" onClick={() => { vibrate("light"); finish(true); }}');
    expect(M).toContain('<button type="button" aria-label="Закрыть" data-lens="disc" data-lens-x="" onClick={() => finish(false)}');
    // крестик — цветом кнопки (в «как сейчас» тот же c.sub)
    expect(M).toContain('const XIcon = ({ color = "currentColor" }) =>');
    expect(M).toContain("padding: 0, color: c.sub }}><XIcon /></button>");
    expect(M).toContain('<div className="ms-modal-card" role="dialog" aria-modal="true" aria-label={title} data-lens-edge="" data-lens-float=""');
    expect(lineOf(M, ">Сертификат мастера ›</button>")).toContain('data-lens-btn="main"');
    expect(lineOf(M, '>Позже</button>')).not.toContain("data-lens");
  });
  it("баннер «Книга отзывов» (ui/guestbook-lite.jsx)", () => {
    const B = rd("ui/guestbook-lite.jsx");
    expect(B).toContain('<div className="sa-bookbanner" data-lens-card="" data-lens-float="" style={{');
    expect(B).toContain('<div data-lens="glyph" style={{ width: 42, height: 42, borderRadius: "50%"');
    expect(B).toContain('<button onClick={open} {...onActivate(open)} data-lens-btn="main" style={{');
    expect(B).toContain('aria-label="Скрыть" data-lens="disc" data-lens-x=""');
  });
  it("«Готова новая версия» (ui/update-toast.jsx)", () => {
    const U = rd("ui/update-toast.jsx");
    expect(U).toContain('<div role="status" data-update-toast="" data-lens-card="" data-lens-float="" className="sa-fadein"');
    expect(U).toContain('<button type="button" data-update-now="" data-lens-btn="main" onClick={reload}');
    expect(lineOf(U, "data-update-later")).not.toContain("data-lens");
  });
  it("«Итоги месяца» (ui/month-recap.jsx): карточки историй прежние, кнопки — линзы", () => {
    const R = rd("ui/month-recap.jsx");
    expect(R).toContain('className="mr-x" data-sa-back={pv ? undefined : ""} aria-label="Закрыть" data-lens="disc"');
    expect(count(R, 'data-lens-btn="main"')).toBe(2);
    expect(R).toContain('<button type="button" className="mr-ghost" data-recap-text="" data-lens-btn="soft" onClick={share}>');
    expect(lineOf(R, '<div className="mr-bg"')).not.toContain("data-lens");
    expect(lineOf(R, ">Закрыть</button>")).not.toContain("data-lens");
  });
  it("«Вопрос дня» (ui/qday-card.jsx): карточка; ответы — стекло, верный и неверный — прежние", () => {
    const Q = rd("ui/qday-card.jsx");
    expect(Q).toContain('<div data-qday-card={done ? (it.correct ? "ok" : "bad") : "ask"} data-lens-card="" style={{');
    expect(Q).toContain('data-lens-opt={right ? "ok" : wrong ? "bad" : ""}');
  });
  it("«Смены в календаре телефона» (ui/cal-sheet.jsx)", () => {
    const C = rd("ui/cal-sheet.jsx");
    expect(C).toContain('aria-label="Закрыть" data-lens="disc" data-lens-x="" onClick={onClose}');
    expect(C).toContain('<div data-cal-next={st.next.length} data-lens-card="" style={{');
    expect(C).toContain('data-cal-sub="" data-lens-btn="main"');
    expect(C).toContain('data-cal-copy="" data-lens-btn="soft"');
    expect(C).toContain('data-cal-url="" data-lens-field=""');
    expect(C).toContain('data-cal-reset="" data-lens-btn={sure ? "danger" : "soft"}');
  });
  it("подсказки (ui/widgets.jsx): «Дальше» и «Понятно» — плашка, значок — линза; пузырь прежний", () => {
    const W = rd("ui/widgets.jsx");
    expect(W).toContain('<span onClick={onNext || onClose} data-lens-btn="main" style={{');
    expect(W).toContain('<span data-lens="glyph" style={{ width:24, height:24, borderRadius:"50%"');
    expect(lineOf(W, 'className="sa-hintglow"')).not.toContain("data-lens");
    expect(lineOf(W, 'title="Больше не показывать"')).not.toContain("data-lens");
  });
  it("голос шефа и сомелье (ui/voice-note.jsx)", () => {
    const V = rd("ui/voice-note.jsx");
    expect(V).toContain('data-voice={v.kind} data-voice-state={st} data-lens-btn="soft" data-lens-hi={on ? "" : undefined}');
    expect(V).toContain('<div style={box} data-voice-rec={kind} data-voice-phase={phase} data-lens-edge="">');
    expect(count(V, 'data-lens-btn="main"')).toBe(3);   // «Готово», «Сохранить», «пауза»
    expect(lineOf(V, ">Убрать</button>")).toContain('data-lens-btn="danger"');
    expect(lineOf(V, " Записать</button>")).toContain('data-lens-btn="soft"');
    expect(V).toContain('data-voices-all={on ? "on" : "off"} data-lens-btn={on ? "soft" : "main"}');
    expect(V).toContain('data-lens-card={playingHere ? "hi" : ""}');
    expect(V).toContain('data-lens-btn="soft" data-lens-hi={rate !== 1 ? "" : undefined}');
    expect(V).toContain('onClick={onClick} disabled={dis} data-lens="disc"');
  });
  it("трек (ui/screens-learning.jsx): шапка, «Работа над ошибками», вид «списком»", () => {
    const L = rd("ui/screens-learning.jsx");
    expect(lineOf(L, 'onClick={onSearch} aria-label="Поиск"')).toContain('data-lens-btn="soft"');
    // подпись — золотом: серая на стекле давала 4,46 (e2e-v30 K, контраст новых экранов)
    expect(lineOf(L, ">Сменить</button>")).toContain('data-lens-btn="soft" data-lens-ink=""');
    expect(L).toContain('className="tbp-mist" data-lens-card="">');
    expect(L).toContain('<div onClick={go} {...onActivate(go)} className="sa-card" data-lens-edge=""');
    expect(L).toContain('<div data-lens-btn="main" style={{ flexShrink:0, padding:"9px 15px", borderRadius:999,');
    expect(L).toContain('<div onClick={onMistakes} {...onActivate(onMistakes)} data-lens-card="" style={{ ...T.modCard, margin:"0 14px 12px" }}>');
    expect(lineOf(L, 'aria-label="Листать темы по одной"')).toContain('data-lens-btn="soft" data-lens-ink=""');
    expect(L).toContain('<div key={m.id} className="sa-card sa-glass" data-lens-card="" style={T.modCard}');
  });
  it("секретная ачивка — прежняя (баннер — «морозное стекло», окно — бумага с печатью)", () => {
    expect(rd("ui/loophole.jsx")).not.toContain("data-lens");
  });
});

describe("v119: тексты", () => {
  it("без тире-ритма и эмодзи в правилах; метка — v119 и позже", () => {
    expect(code(LOOK)).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(dashes(LOOK)).toBe(0);
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(119|1[2-9]\d|[2-9]\d\d)<\/span>/);
  });
});
