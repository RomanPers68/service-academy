// v121 (Доп. 434): роли в линзах. Владелец (31.10, два снимка: панель «Хостес» под «Треками обучения» и список
// «Хостес / Официант / Менеджмент / Бар» с «На подходе»): «И может ещё роли в эффект линзы?». Метки data-lens-* в
// ui/tracks-row.jsx и ui/screens-roleselect.jsx, раздел v121 в ui/home-look.jsx — всё под html.sa-lens, вид «как сейчас»
// прежний (стили в разметке не менялись). e2e — tools/claude/e2e-v121.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const LOOK = rd("ui/home-look.jsx");
const V121 = LOOK.slice(LOOK.indexOf("/* ── v121"), LOOK.lastIndexOf("`;"));
const rules = code(V121).split("}").map((r) => r.trim()).filter(Boolean);
const sels = rules.map((r) => r.split("{")[0].trim()).flatMap((s) => s.split(",").map((x) => x.trim()));
const ROW = rd("ui/tracks-row.jsx");
const RS = rd("ui/screens-roleselect.jsx");
const lineOf = (src, label) => src.split("\n").find((l) => l.includes(label)) || "";
// специфичность простого селектора: [id, классы и атрибуты, теги]
const spec = (s) => {
  const t = s.replace(/::?[a-z-]+(\([^)]*\))?/g, (m) => (m.startsWith("::") ? " " : m.replace(/^:not\((.*)\)$/, "$1")));
  return [0, (t.match(/\.[\w-]+|\[[^\]]+\]/g) || []).length, (t.match(/(^|[\s>+~])[a-z]+/g) || []).length];
};
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

describe("v121: правила линзы (ui/home-look.jsx, раздел v121)", () => {
  it("раздел v121 — последний, после v119; каждое правило — только под html.sa-lens", () => {
    expect(LOOK.indexOf("/* ── v121")).toBeGreaterThan(LOOK.indexOf("/* ── v119"));
    expect(LOOK.indexOf("/* ── v", LOOK.indexOf("/* ── v121") + 5)).toBe(-1);
    expect(sels.length).toBeGreaterThan(14);
    for (const s of sels) expect(s, s).toMatch(/^html\.sa-lens(\.sa-light)?[ [.]/);
  });
  it("панель трека: кромка, блик и свечение внутрь, без внешней тени (обёртка раскрытия срезала бы её)", () => {
    const r = rules.find((x) => x.startsWith("html.sa-lens [data-track-panel]{"));
    expect(r).toBe("html.sa-lens [data-track-panel]{box-shadow:inset 0 0 0 1px var(--lk-edge),inset 0 1.5px 0 var(--lk-hl),inset 0 0 22px var(--lk-cglow)!important");
    expect(r.replace(/inset [^,!]+/g, "")).not.toMatch(/\d+px/);
  });
  it("язычок и черта под ним — золотом, как кольцо выбранного кружка (в обеих темах)", () => {
    expect(V121).toContain("html.sa-lens [data-track-notch]{border-bottom-color:rgba(232,201,131,0.72)!important}");
    expect(V121).toContain("html.sa-lens.sa-light [data-track-notch]{border-bottom-color:rgba(139,106,48,0.6)!important}");
    expect(V121).toContain("html.sa-lens [data-track-line]{background:linear-gradient(90deg,transparent,var(--lk-hi),transparent)!important;opacity:0.9!important}");
  });
  it("«свернуть» — линза 32 px в углу; первые две строки уступают ей место", () => {
    expect(V121).toContain("html.sa-lens [data-track-close]{top:6px!important;right:6px!important}");
    expect(V121).toContain("html.sa-lens [data-track-head]{padding-right:44px!important}");
    expect(V121).toContain("html.sa-lens [data-track-desc]{padding-right:40px!important}");
    // 6 + 32 + кольцо 3,5 = 41,5 px от края: строка-описание кончается раньше (40 + поле панели 12)
    expect(6 + 32 + 3.5).toBeLessThan(40 + 12);
  });
  it("«Открыть ›» — плашка: поля внутри, снаружи столько же отрицательного отступа (высота строки прежняя)", () => {
    const r = rules.find((x) => x.startsWith('html.sa-lens [data-track-go][data-lens-btn="main"]{'));
    expect(r).toBe('html.sa-lens [data-track-go][data-lens-btn="main"]{padding:3px 11px!important;margin:-3px 0!important');
    const pad = Number(r.match(/padding:(\d+)px/)[1]), mar = Number(r.match(/margin:-(\d+)px/)[1]);
    expect(pad).toBe(mar);
    // на 320 px «Приём гостей · не начат · Открыть ›» с плашкой влезает, только если нить может быть короче 24 px
    expect(V121).toContain("html.sa-lens [data-track-bar]{min-width:12px!important}");
    expect(ROW).toContain('<div aria-hidden data-track-bar="" style={{ flex: 1, minWidth: 24, height: 3, borderRadius: 3,');
  });
  it("«твой» и «скоро» — стекло без своей рамки; в «Для чтения» мелкие подписи — тёмным золотом", () => {
    expect(V121).toContain("html.sa-lens [data-track-mine],html.sa-lens [data-soon-tag]{border-color:transparent!important}");
    expect(V121).toContain('html.sa-lens.sa-light [data-track-panel] [data-lens-btn="main"],html.sa-lens.sa-light [data-track-mine]{color:#6B4E1A!important}');
  });
  it("значки ролей прежнего размера: правило сильнее «значок темы чуть меньше» из v119 и стоит после него", () => {
    const v119 = 'html.sa-lens .sa-card.sa-glass[data-lens-card]>[data-lens="disc"]>svg';
    expect(LOOK).toContain(v119 + "{transform:scale(0.78)}");
    const mine = sels.filter((s) => /\[data-(role|group)-card\]>\[data-lens="disc"\]>svg$/.test(s));
    expect(mine.length).toBe(2);
    for (const s of mine) expect(cmp(spec(s), spec(v119)), s).toBeGreaterThan(0);
    expect(V121).toMatch(/\[data-group-card\]>\[data-lens="disc"\]>svg\{transform:none\}/);
    expect(LOOK.indexOf("[data-role-card]>[data-lens=\"disc\"]>svg")).toBeGreaterThan(LOOK.indexOf(v119));
  });
  it("номера ступеней — линзы: стекло на плотном тоне (нить не просвечивает), кольцо; пройденная — прежняя", () => {
    const dark = rules.find((x) => x.startsWith("html.sa-lens .sa-step:not(.done) .sa-stepnum{"));
    const light = rules.find((x) => x.startsWith("html.sa-lens.sa-light .sa-step:not(.done) .sa-stepnum{"));
    expect(dark).toMatch(/background:radial-gradient\([^;]+\),#1C160C;/);
    expect(light).toMatch(/background:radial-gradient\([^;]+\),#F4EAD3;/);
    expect(dark).toContain("border-color:transparent");
    expect(V121).toContain('html.sa-lens .sa-step:not(.done) .sa-stepnum::after{content:"";position:absolute;inset:-3.5px;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(code(V121)).not.toMatch(/\.sa-step\.done/);
  });
  it("правила раздела — по меткам и классам этих двух экранов, ничего чужого", () => {
    for (const s of sels) expect(s, s).toMatch(/data-track-|data-soon-tag|data-role-card|data-group-card|\.sa-step|data-hr-inrow/);
  });
  it("ряд ответа AI-интервью в «Линзе»: промежуток шире (кольца не сходятся), справа поле под кольцо волны", () => {
    expect(V121).toContain("html.sa-lens [data-hr-inrow]{gap:12px!important;padding-right:4px!important}");
    // кольцо — 3,5 px снаружи кнопки: между кольцами 12 − 7 = 5 px, справа 4 − 3,5 = 0,5 px до края ленты
    expect(12 - 2 * 3.5).toBeGreaterThanOrEqual(4);
    expect(4 - 3.5).toBeGreaterThanOrEqual(0);
  });
});

describe("v121: панель выбранного трека (ui/tracks-row.jsx)", () => {
  it("метки: строки панели, черта, «твой», «Открыть ›», «свернуть»", () => {
    expect(ROW).toContain('<div data-track-head="" style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, paddingRight: 28 }}>');
    expect(ROW).toContain('<div data-track-desc="" style={{ marginTop: 3,');
    expect(ROW).toContain('<span aria-hidden data-track-line="" style={{ position: "absolute", top: 0, left: notchX - 22,');
    expect(ROW).toContain('<span data-track-mine="" data-lens-tag="" style=');
    expect(ROW).toContain('<span data-track-go="" data-lens-btn="main" style=');
    expect(ROW).toContain('<button type="button" data-track-close="" data-lens="disc" data-lens-x="" aria-label="Свернуть"');
  });
  it("вид «как сейчас» прежний: стили в разметке те же (22 px, 8 px от края, «Открыть ›» без полей)", () => {
    const close = ROW.slice(ROW.indexOf("data-track-close"), ROW.indexOf("</button>", ROW.indexOf("data-track-close")));
    expect(close).toContain('position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%"');
    expect(lineOf(ROW, "data-track-go")).toContain('style={{ fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 13, color: inkOf(x.r.color, a11y), whiteSpace: "nowrap" }}>Открыть ›</span>');
    expect(lineOf(ROW, "data-track-mine")).toContain('color: gold, border: `1px solid ${gold}66`, borderRadius: 999, padding: "0 6px"');
    expect(lineOf(ROW, "data-track-line")).toContain("background: `linear-gradient(90deg, transparent, ${c}, transparent)`");
    expect(ROW).toContain('borderBottom: `7px solid ${c}${ex.open ? "AA" : "66"}`');
    expect(ROW).toContain('boxShadow: `inset 0 0 0 1px ${c}${ex.open ? "59" : "33"}, inset 0 0 22px ${a11y ? "rgba(255,255,255,0.45)" : "rgba(255,230,170,0.06)"}` }}>');
  });
});

describe("v121: ряд ответа в AI-интервью (ui/candidate.jsx; владелец: «Ответ голосом съехал вниз»)", () => {
  const C = rd("ui/candidate.jsx");
  const row = C.slice(C.indexOf('<div data-hr-inrow=""'), C.indexOf("{/* v66: с планом"));
  it("ряд прижимает всё к низу; микрофон 46 px, как волна и «Отправить»; у всех трёх отступ 3 снизу (центры на линии поля)", () => {
    expect(row).toContain('<div data-hr-inrow="" style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>');
    expect(row).toContain('<div style={{ display: "flex", flexShrink: 0, marginBottom: 3 }}>\n              <MicButton a11y={a11y} size={46} sttUrl=');
    expect(row).toContain('<div style={{ alignSelf: "flex-end", display: "flex", marginBottom: 3 }}>\n                  <TalkButton size={46}');
    expect(row).toContain('style={{ width: 46, height: 46, alignSelf: "flex-end", marginBottom: 3, borderRadius: RADIUS.md,');
    // поле в одну строку: 13 + 14 × 1,45 + 13 + рамка 2 = 48,3 px и отступ 2 снизу → центр в 26,15 px от низа ряда;
    // кнопка 46 px с отступом 3 → центр в 26 px: расхождение меньше 0,2 px (было: волна на 3,15 ниже, микрофон на 2,15 выше)
    const field = 13 + 14 * 1.45 + 13 + 2;
    expect(Math.abs((2 + field / 2) - (3 + 46 / 2))).toBeLessThan(0.2);
    expect(row).toContain("lineHeight: 1.45, resize: \"none\", maxHeight: 110");
    expect(C).toContain('padding:"13px 14px", borderRadius: RADIUS.sm, fontSize:14,');
  });
});

describe("v121: демо — AI-интервью без нейросети (владелец смотрит ряд ответа)", () => {
  const B = rd("tools/claude/demo-app/boot.js");
  it("ai-hr отвечает по плану: пять тем по вопросу, в конце — демо-оценка; ответ — в формате ai-hr v2", async () => {
    expect(B).toContain("if (/\\/functions\\/v1\\/ai-hr/.test(url)) {");
    const src = B.slice(B.indexOf("const HR_TOPICS"), B.indexOf("// ── сервер вместо Supabase"));
    const demoHr = new Function(src + "; return demoHr;")();
    let r = demoHr({ mode: "chat", plan: [], messages: [] });
    expect(r).toMatchObject({ ok: true, v: 2, topic: 0, done: false, total: 5 });
    expect(r.reply).toMatch(/^Здравствуйте!/);
    const plan = [{ topic: 0 }];
    for (let k = 1; k < 5; k++) { r = demoHr({ mode: "chat", plan }); expect(r.topic).toBe(k); plan.push({ topic: k }); }
    r = demoHr({ mode: "chat", plan });
    expect(r).toMatchObject({ topic: -1, done: true });
    r = demoHr({ mode: "assess" });
    expect(Object.keys(r.scores)).toHaveLength(5);
    expect(r.verdict).toMatch(/демо/i);
  });
});

describe("v121: «Новички» — текст карточек не чёрный (владелец: «текст на тёмной теме чёрный»)", () => {
  const N = rd("ui/newbie.jsx");
  it("карточки, где только текст, — цветом и размером строк экрана; цвет задан, а не взят по умолчанию", () => {
    expect(N).toContain("const textCard = { ...card, fontSize: 14, lineHeight: 1.45, color: text };");
    expect(N).toContain("return { c, card, textCard, sub, text, ghost, main, h, line };");
    for (const k of ["data-nb-missing", "data-nb-notnew", "data-nbl-missing", "data-nbl-empty"]) expect(N, k).toContain('<div style={textCard} data-lens-card="" ' + k + '="">');
    // строки экрана (line) — те же 14 px, 1,45 и цвет text
    expect(N).toContain('<div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.45, color: text }}>');
    // остальные карточки — прежние (в них у каждой строки свой цвет)
    expect(N.split("style={card}").length - 1).toBeGreaterThanOrEqual(5);
  });
});

describe("v121: список треков (ui/screens-roleselect.jsx)", () => {
  it("роли и профессии — карточки линзы, значки — линзы с оттенком роли снизу (у закрытых — без оттенка)", () => {
    expect(RS).toContain('<div key={r.id} data-lens-card="" data-role-card={r.id}');
    expect(RS).toContain('<div key={g.id} data-lens-card="" data-group-card={g.id}');
    expect(RS).toContain('filter: isUnlocked ? "none" : "grayscale(1)", "--tint": isUnlocked ? r.color + "55" : "transparent" }}>');
    expect(RS).toContain('filter: anyUnlocked ? "none" : "grayscale(1)", "--tint": anyUnlocked ? g.color + "55" : "transparent" }}>');
    expect(lineOf(RS, '"--tint": isUnlocked ? r.color')).toMatch(/^\s*<div data-lens="disc" style=\{\{ \.\.\.T\.roleIcon,/);
    expect(lineOf(RS, '"--tint": anyUnlocked ? g.color')).toMatch(/^\s*<div data-lens="disc" style=\{\{ \.\.\.T\.roleIcon,/);
  });
  it("ступени — кромка; «На подходе» — карточки, значки — линзы, «скоро» и «новое» — стекло", () => {
    expect(RS).toContain('<div key={r.id} className={cls} data-lens-edge="" data-step-card={r.id} onClick={go} {...onActivate(go)}>');
    expect(RS).toContain('<div key={s.key} data-lens-card="" data-soon-card={s.key}');
    expect(RS).toContain('<div data-lens="disc" style={{ width:38, height:38, borderRadius:"50%", flexShrink:0,');
    expect(RS.split('data-lens-tag="" data-soon-tag=""').length - 1).toBe(2);
  });
  it("ничего лишнего: заголовок «Треки обучения», замки и стрелки ›, переключатель списка — прежние", () => {
    expect(lineOf(RS, "data-tracks-toggle=")).not.toContain("data-lens");
    expect(lineOf(RS, 'ROLE_SVG.lock("rgba(255,255,255,0.28)", 17)')).not.toContain("data-lens");
    expect(lineOf(RS, '<div style={{ fontSize:21, color: r.color+"99", fontWeight:"bold" }}>›</div>')).not.toContain("data-lens");
  });
  it("без тире-ритма и эмодзи в разметке; метка сборки — v121", () => {
    for (const f of ["ui/tracks-row.jsx", "ui/screens-roleselect.jsx", "ui/home-look.jsx"]) expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(dashes(ROW)).toBe(0);
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v121</span>");
  });
});
