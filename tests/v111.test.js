// v111 (Доп. 424): линза на новых экранах. Владелец (30.10) после «было / стало» v110: «Мы можем в них интегрировать линзы?».
// «Утро руководителя», «Новички», «Первая неделя», «Спасибо от коллег», «Что дало обучение» и вкладки «Смена», «Команда», «Я» —
// тем же языком, что главная и чат: круглое — линзы, главные кнопки — стеклянные плашки с кольцом, остальные — стекло с ободком,
// поля — стекло, карточки — стекло со светом. Состояния (галочки, переключатели, выбор часа, плашки тем, полоски) — прежние,
// вид «как сейчас» — весь прежний (правила только под html.sa-lens). e2e — tools/claude/e2e-v111.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const R = (el) => renderToString(el);
const h = React.createElement;
const noop = () => {};
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const LOOK = rd("ui/home-look.jsx");
const V111 = LOOK.slice(LOOK.indexOf("/* ── v111"), LOOK.lastIndexOf("`;"));
const T = { modCard: {}, modSub: { color: "#9C8760" }, modTitle: { color: "#EFE4C8" }, screen: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, para: {} };
// каждая кнопка со стилем ghost (или от него) помечена data-lens-btn
const ghostsMarked = (src) => {
  const out = [];
  for (const m of code(src).matchAll(/style=\{(ghost|\{ \.\.\.ghost[^}]*\})\}|style=\{cf \? ghost : \{[^}]*\}\}/g)) out.push(code(src).slice(m.index, m.index + 260));
  return out;
};

describe("v111: правила линзы для новых экранов (ui/home-look.jsx)", () => {
  it("раздел v111 после v105; каждое правило — только под html.sa-lens: вид «как сейчас» не меняется", () => {
    expect(LOOK.indexOf("/* ── v111")).toBeGreaterThan(LOOK.indexOf("/* ── v105"));
    const sel = code(V111).split("}").map((r) => r.split("{")[0].trim()).filter(Boolean);
    expect(sel.length).toBeGreaterThan(20);
    for (const s of sel) for (const one of s.split(",")) expect(one.trim(), one).toMatch(/^html\.sa-lens(\.sa-light)?(\s|\{|$)/);
  });
  it("карточки — золотая кромка, блик и свет слева сверху, как на главной; «сейчас» и «самостоятельная» — свои кромки", () => {
    expect(V111).toContain("html.sa-lens{--lk-edge:rgba(214,178,102,0.30);--lk-shadow:0 5px 16px rgba(0,0,0,0.45);--lk-light:rgba(214,178,102,0.10);--lk-cglow:rgba(255,248,230,0.07)}");
    expect(V111).toContain("html.sa-lens.sa-light{--lk-edge:rgba(139,106,48,0.30);--lk-shadow:0 4px 12px rgba(120,85,25,0.18);--lk-light:rgba(255,255,255,0.55);--lk-cglow:rgba(255,255,255,0.5)}");
    expect(V111).toContain("html.sa-lens [data-lens-card]{border-color:var(--lk-edge)!important;background-image:radial-gradient(120% 70px at 20% 0%,var(--lk-light),transparent 60%)!important;");
    expect(V111).toContain("box-shadow:inset 0 1.5px 0 var(--lk-hl),inset 0 0 22px var(--lk-cglow),var(--lk-shadow)!important}");
    // тот же свет, что у карточек главной в виде «Линза» (там — на всю карточку)
    expect(LOOK).toContain(".sa-look-lens .sa-dp,.sa-look-lens [data-tile],.sa-look-lens [data-tools-capsule]{background:radial-gradient(120% 90% at 20% 0%,var(--lk-light),transparent 60%),var(--lk-card)!important}");
    // фон карточки и свечение по краям — прежние (свои у карточки): подписи читаются так же, как в v110
    const rule = V111.slice(V111.indexOf("html.sa-lens [data-lens-card]{"), V111.indexOf('html.sa-lens [data-lens-card="hi"]'));
    expect(rule).not.toMatch(/background(-color)?:(?!-)/);
    expect(rule).not.toContain("--lk-glow");
    expect(V111).toContain('html.sa-lens [data-lens-card="hi"]{border-color:var(--lk-hi)!important}');
    expect(V111).toContain('html.sa-lens [data-lens-card="ok"]{border-color:rgba(138,216,175,0.7)!important}');
    expect(V111).toContain('html.sa-lens.sa-light [data-lens-card="ok"]{border-color:rgba(44,107,72,0.6)!important}');
  });
  it("кружки строк — линзы с ободком цвета строки (сведения — золото, внимание — янтарь, сделано — зелёный), в «Для чтения» — тёмные", () => {
    expect(V111).toContain('html.sa-lens [data-lens="glyph"]{--g:214,178,102;background:rgba(var(--g),0.10)!important;border-color:transparent!important;');
    expect(V111).toContain('html.sa-lens [data-lens="glyph"]::after{border-color:rgba(var(--g),0.42)}');
    expect(V111).toContain('html.sa-lens [data-lens="glyph"][data-glyph-kind="warn"]{--g:228,179,106}');
    expect(V111).toContain('html.sa-lens [data-lens="glyph"][data-glyph-kind="ok"]{--g:138,216,175}');
    expect(V111).toContain('html.sa-lens.sa-light [data-lens="glyph"][data-glyph-kind="warn"]{--g:139,90,18}');
    expect(V111).toContain('html.sa-lens.sa-light [data-lens="glyph"][data-glyph-kind="ok"]{--g:44,107,72}');
    // кольцо снаружи — общее правило линз v102
    expect(LOOK).toContain('html.sa-lens [data-lens]::after,html.sa-lens .tbp-view::after');
  });
  it("кружки людей — стекло, инициалы золотом (как в листе «Спасибо коллеге»)", () => {
    expect(V111).toContain('html.sa-lens [data-lens="person"]{background:var(--lk-glass)!important;color:var(--lk-gold)!important;');
  });
  it("главные кнопки — стеклянные плашки с кольцом и золотой надписью, как «Предупредить»; остальные — стекло с ободком без кольца", () => {
    expect(V111).toContain("html.sa-lens [data-lens-btn]{border-radius:999px!important}");
    expect(V111).toContain('html.sa-lens [data-lens-btn="main"]{position:relative;color:var(--lk-hi)!important;font-weight:bold!important;border-color:transparent!important;');
    expect(V111).toContain("background:radial-gradient(120% 160% at 50% 0%,rgba(232,201,131,0.24),rgba(200,169,110,0.12) 62%)!important;");
    expect(LOOK).toContain("background:radial-gradient(120% 160% at 50% 0%,rgba(232,201,131,0.24),rgba(200,169,110,0.12) 62%)!important;\n  box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 18px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl),0 4px 14px rgba(0,0,0,0.28)!important}");
    expect(V111).toContain('html.sa-lens [data-lens-btn="main"]::after{content:"";position:absolute;inset:-3.5px;border-radius:999px;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(V111).toContain('html.sa-lens.sa-light [data-lens-btn="main"]{background:radial-gradient(120% 160% at 50% 0%,rgba(255,255,255,0.85),rgba(176,138,70,0.22) 70%)!important;');
    expect(V111).toContain('html.sa-lens [data-lens-btn="soft"]{background:var(--lk-glass)!important;border-color:transparent!important;');
    expect(V111).not.toMatch(/\[data-lens-btn="soft"\][^{]*::after/);
    expect(V111).toContain('html.sa-lens [data-lens-btn="soft"][data-lens-hi]{box-shadow:inset 0 0 0 1px var(--lk-hi),');
  });
  it("поля — стекло с ободком, в фокусе ярче; «сейчас» — стекло; значки кнопок-групп — линзы 38 px; «закрыть» листа — 32 px", () => {
    expect(V111).toContain("html.sa-lens [data-lens-field]{background:var(--lk-glass)!important;border-color:transparent!important;");
    expect(V111).toContain("html.sa-lens [data-lens-field]:focus{box-shadow:inset 0 0 0 1px var(--lk-hi),");
    expect(V111).toContain("html.sa-lens [data-lens-tag]{background:var(--lk-glass)!important;");
    expect(V111).toContain("html.sa-lens [data-hub-disc]{width:38px!important;height:38px!important;border-radius:50%}");
    expect(V111).toContain("html.sa-lens [data-hub-disc]>svg{width:21px;height:21px}");
    expect(V111).toContain("html.sa-lens [data-nb-x]{width:32px!important;height:32px!important;margin:2px;font-size:20px!important}");
  });
});

describe("v111: «Утро руководителя»", () => {
  const src = rd("ui/morning.jsx");
  it("кружок строки — линза data-lens=\"glyph\", отметка «!» и галочка — поверх кольца", async () => {
    const { GlyphMark } = await import("../ui/glyphs.jsx");
    const c = { ok: "#8AD8AF", warn: "#E4B36A", gold: "#C8A96E", chip: "rgba(214,178,102,0.10)" };
    const warn = R(h(GlyphMark, { icon: "brief", kind: "warn", c })), info = R(h(GlyphMark, { icon: "sun", kind: "info", c }));
    expect(warn).toContain('data-glyph-kind="warn" data-lens="glyph"');
    expect(warn).toMatch(/data-glyph-mark="" style="position:absolute;z-index:1;right:-5px;bottom:-5px/);
    expect(info).toContain('data-lens="glyph"');
    expect(info).not.toContain("data-glyph-mark");
  });
  it("все карточки — data-lens-card; «Собрать брифинг» — главная; «Обновить», «Напомнить», «Подключить», «Прислать сейчас» — стекло", () => {
    expect((src.match(/style=\{card\} data-lens-card="" data-mo-/g) || []).length).toBe(7);
    expect(code(src)).not.toMatch(/style=\{card\} data-mo-/);
    expect(src).toContain('<button type="button" style={main} data-lens-btn="main" data-mo-brief=""');
    const g = ghostsMarked(src);
    expect(g.length).toBe(6);
    for (const x of g) expect(x.slice(0, x.indexOf(">") + 1), x).toMatch(/data-lens-btn="soft"/);
  });
  it("переключатель и выбор часа — прежние (состояния)", () => {
    const tg = src.slice(src.indexOf('role="switch"'), src.indexOf("{!prefs.bot ?"));
    expect(tg).toContain("data-mo-hour={x}");
    expect(tg).not.toContain("data-lens");
  });
});

describe("v111: «Новички» и «Первая неделя»", () => {
  const src = rd("ui/newbie.jsx");
  it("кружки с инициалами — линзы-«люди»; «закрыть» листа — линза; поиск и поля памятки — стекло", () => {
    expect(src).toContain('const Ava = ({ name, c, size = 40 }) => (\n  <span aria-hidden="true" data-lens="person" style={{');
    expect(src).toContain('data-sa-back="" data-lens="disc" data-nb-x="" aria-label="Закрыть"');
    expect(src).toContain('<input className="sa-field" type="search" data-lens-field="" data-nb-search=""');
    expect(src).toContain('<textarea className="sa-field" data-lens-field="" data-nb-memo={k}');
    expect(src).toContain('<input className="sa-field" data-lens-field="" data-nb-memo={k}');
  });
  it("главные: «Представить команде», «Сохранить», «Добавить новичка из команды»; остальные — стекло, «Подтвердить» — ободок ярче", () => {
    expect(src).toContain('style={main} data-lens-btn="main" data-nbl-hello={n.emp}');
    expect(src).toContain('data-lens-btn="main" data-nb-memo-save=""');
    expect(src).toContain('marginBottom: 16 }} data-lens-btn="main" data-nbl-add=""');
    expect(src).toContain('data-lens-btn="soft" data-lens-hi={cf ? undefined : ""} data-nbl-confirm={step}');
    const g = ghostsMarked(src);
    expect(g.length).toBe(13);
    for (const x of g) expect(x.slice(0, x.indexOf(">") + 1), x).toMatch(/data-lens-btn="(soft|main)"/);
  });
  it("карточки — data-lens-card; раздел «сейчас» — золотая кромка, «вышел на самостоятельную» — зелёная; «сейчас» — стекло", () => {
    expect(src).toContain('...(now ? { border: "1px solid " + c.gold } : {}) }} data-lens-card={now ? "hi" : ""}>');
    expect(src).toContain('style={{ ...card, border: "1px solid " + c.ok }} data-lens-card="ok" data-nb-solo=""');
    expect(src).toContain('<span data-lens-tag="" style={{ fontStyle: "normal", fontSize: 11.5,');
    for (const k of ["data-nb-missing", "data-nb-notnew", 'data-nb-sec="first"', 'data-nb-sec="buddy"', "data-nb-team", "data-nbl-memo=", "data-nbl-item", "data-nbl-missing", "data-nbl-empty", "data-nbl-led"])
      expect(src, k).toMatch(new RegExp('data-lens-card="" ' + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
  it("галочки шагов, плашки тем, выбор минут, полоски и «Убрать из новичков» — прежние", () => {
    const check = src.slice(src.indexOf("function Check("), src.indexOf("const Ava = "));
    expect(check).not.toContain("data-lens");
    const bar = src.slice(src.indexOf("function Bar("), src.indexOf("// лист снизу"));
    expect(bar).not.toContain("data-lens");
    expect(src).toContain("<span style={chip}>{f.topic");
    expect(src).toContain('return <button key={x} type="button" aria-pressed={on} data-nb-arrive={x}');
    expect(src).toContain('{lead ? <button type="button" data-nbl-off={n.emp} disabled={!!busy}');
  });
});

describe("v111: «Спасибо от коллег» и «Что дало обучение»", () => {
  it("«Спасибо от коллег»: инициалы — линзы, «Сказать спасибо коллеге» — главная, карточки — стекло со светом", () => {
    const src = rd("ui/peer-thanks.jsx");
    expect(src).toContain('const Ava = ({ name, size = 34 }) => (\n  <span aria-hidden="true" data-lens="person" style={{');
    expect(src).toContain('<button type="button" data-lens-btn="main" data-peer-say=""');
    expect(src).toContain('data-lens-card="" data-peer-stats=""');
    expect(src).toContain('<div key={x.msg} data-lens-card="" data-peer-item={x.msg}');
    expect(src).toContain('data-lens-card="" data-peer-missing=""');
  });
  it("«Что дало обучение»: выбранный месяц — плашка с кольцом, другой — стекло; инициалы — линзы; карточки и кнопки", () => {
    const src = rd("ui/gain.jsx");
    expect(src).toContain('aria-pressed={sel} data-lens-btn={sel ? "main" : "soft"} data-gain-month={x}');
    expect(src).toContain('const Ava = ({ name, size = 32 }) => (\n  <span aria-hidden="true" data-lens="person" style={{');
    expect((src.match(/style=\{card\} data-lens-card="" data-gain-/g) || []).length).toBe(6);
    expect(src).toContain('<div style={{ ...card, padding: "12px 10px" }} data-lens-card="" data-gain-sec="learn">');
    const g = ghostsMarked(src);
    expect(g.length).toBe(5);
    for (const x of g) expect(x.slice(0, x.indexOf(">") + 1), x).toMatch(/data-lens-btn="soft"/);
  });
});

describe("v111: вкладки «Смена», «Команда», «Я»", () => {
  const it_ = (key, group, extra = {}) => ({ key, group, icon: "schedule", label: "Пункт " + key, sub: "подпись", onClick: noop, ...extra });
  it("кнопка-группа и группа из одного раздела — стекло со светом, значок в линзе; строки внутри — без кружков", async () => {
    const { HubScreen } = await import("../ui/home-hubs");
    const items = [it_("a", "На смене", { badge: 3 }), it_("b", "На смене"), it_("c", "Потренироваться")];
    const shut = R(h(HubScreen, { T, a11y: false, title: "Смена", compactGroups: true, fold: true, hubId: "shift", items }));
    expect(shut).toMatch(/data-hub-group="На смене" data-hub-open="0" data-lens-card=""/);
    expect(shut).toMatch(/data-hub-group="Потренироваться" data-hub-single="" data-lens-card=""/);
    expect((shut.match(/data-lens="disc" data-hub-disc=""/g) || []).length).toBe(2);
    expect(shut).toMatch(/data-hub-badge="3" aria-hidden="true" style="position:absolute;z-index:1;top:-6px;right:-9px/);
    const was = globalThis.localStorage;
    globalThis.localStorage = { getItem: (k) => (k === "sa_hub_open" ? JSON.stringify({ shift: ["На смене"] }) : null), setItem: () => {} };
    try {
      const open = R(h(HubScreen, { T, a11y: false, title: "Смена", compactGroups: true, fold: true, hubId: "shift", items }));
      const rows = open.slice(open.indexOf('class="sa-hubrows"'), open.indexOf('data-hub-group="Потренироваться"'));
      expect(rows).toContain("data-hub-ic");
      expect(rows).not.toContain("data-lens");
    } finally { globalThis.localStorage = was; }
  });
  it("живые карточки над группами — data-lens-card: смена, «Первая неделя», роль в смене, брифинг, квест, лидеры, мастер, лента, «Я»", async () => {
    const { NewbieHero, MeHero } = await import("../ui/home-hubs");
    expect(R(h(NewbieHero, { a11y: false, line: "Первая смена: сегодня, 12:00", done: 1, total: 12, onOpen: noop }))).toContain('data-nb-hero="" data-lens-card=""');
    expect(R(h(MeHero, { a11y: false, done: 7, total: 85, streak: { count: 0 }, roleLabel: "Новичок" }))).toContain('data-lens-card=""');
    const hubs = code(rd("ui/home-hubs.jsx"));
    expect((hubs.match(/data-lens-card=""/g) || []).length).toBe(11);
    expect(hubs).toContain('<div className="sa-card sa-pagein" data-ms-banner="" data-lens-card="" role="button"');
    expect(hubs).toContain('<div className="sa-card sa-pagein" data-team-feed="" data-lens-card="" style=');
    expect(hubs).toContain('<span aria-hidden="true" data-lens="disc" style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%"');
    expect(rd("ui/together.jsx")).toContain('<div className={"sa-card sa-pagein tg-quest" + (open ? " open" : "")} data-lens-card="" style=');
    const role = rd("ui/shift-role.jsx");
    for (const k of ["host", "lead", "staff"]) expect(role).toContain('data-shift-role="' + k + '" data-lens-card=""');
    expect(rd("ui/briefing.jsx")).toContain('<div data-brief-card="" data-lens-card="" data-seen={seen ? "1" : "0"} role="button"');
  });
});

describe("v111: тексты и метка", () => {
  it("без тире-ритма и эмодзи в изменённых файлах; метка — v111", () => {
    for (const f of ["ui/glyphs.jsx", "ui/morning.jsx", "ui/newbie.jsx", "ui/peer-thanks.jsx", "ui/gain.jsx", "ui/home-look.jsx"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v111</span>");
  });
});
