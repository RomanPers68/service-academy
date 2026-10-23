// v40 (отзыв владельца, визуал): действия темы — крупные плитки («Освежить», «Раунд мастера», «Я это умею»),
// «Погреб тем ›» — кнопка, печать раздела не закрывает название, живой диалог крупнее, светлая тема
// «Для чтения» — мелкий текст от 13 px (метки — от 11 px). Здесь — разметка и стили; размеры на экране,
// перекрытия и обе темы на 320–430 px — в браузере: /home/claude/preview/e2e-v40-visual.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const noop = () => {};
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/\u00A0/g, " ");
// плитки действий: класс, атрибуты, название, подпись, есть ли значок
const tiles = (html) => [...html.matchAll(/<button([^>]*class="(tbm-act[^"]*)"[^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({
  attrs: m[1], cls: m[2], title: (m[3].match(/class="tbm-act-t">([^<]*)</) || [])[1], sub: (m[3].match(/class="tbm-act-s">([^<]*)</) || [])[1],
  icon: /class="tbm-act-ic" aria-hidden="true"><svg/.test(m[3]), label: (m[1].match(/aria-label="([^"]*)"/) || [])[1] }));
const doneOf = (mod) => { const c = {}, q = {}; mod.lessons.forEach((l) => { if (l.type === "quiz") q[l.id] = true; else if (l.type !== "result") c[l.id] = true; }); return { c, q }; };
const quizMod = (id, n) => ({ id, title: "Своя тема " + id, lessons: [{ id: id + "-1", type: "lesson", title: "Урок", content: "Текст" },
  { id: id + "-q", type: "quiz", title: "Тест", questions: Array.from({ length: n }, (_, i) => ({ q: "Вопрос " + i, options: ["а", "б"], correct: 0 })) }] });

describe("v40: плитки действий темы", () => {
  it("пройдена и выдохлась — «Освежить» (.hot) и «Раунд мастера»: значок, название, что внутри; «Погреб тем ›»", async () => {
    const { SEASONAL_MODULES } = await import("../data/modules-seasonal");
    const { ModuleMenu } = await import("../ui/module-menu");
    const S0 = SEASONAL_MODULES.find((m) => m.id === "s0");
    const { c, q } = doneOf(S0);
    const html = R(h(ModuleMenu, { mod: S0, completed: c, quizDone: q, onLesson: noop, embedded: true, topic: { f: { level: "faded", k: 0.3, days: 12 }, canGold: true }, acts: { onRefresh: noop, onGold: noop, onCellar: noop } }));
    const t = tiles(html);
    expect(t.map((x) => x.cls)).toEqual(["tbm-act hot", "tbm-act gold"]);
    expect(t[0]).toMatchObject({ title: "Освежить", sub: "3 ситуации · 1 мин", icon: true, label: "Освежить · 1 мин · 3 ситуации" });
    expect(t[1]).toMatchObject({ title: "Раунд мастера", sub: "8 заданий → тема золотая", icon: true });
    expect(html).toContain('<button type="button" class="tbm-cellar">Погреб тем ›</button>');
    expect(html).toContain('<span class="tbm-fresh-t"><span>Тема выдохлась</span></span>');
    // меню пройденного раздела — с местом под печать, сама печать — на углу
    expect(html).toContain('class="tbm-menu sealed"');
    expect(html).toMatch(/<span class="tbm-seal(?: stamp)?" aria-hidden="true"><svg width="46" height="46"/);
  });

  it("золото — «Золото ✦ · ещё раз / побей свой рекорд»; строка свежести переносится только между частями", async () => {
    const { SEASONAL_MODULES } = await import("../data/modules-seasonal");
    const { ModuleMenu } = await import("../ui/module-menu");
    const S0 = SEASONAL_MODULES.find((m) => m.id === "s0");
    const { c, q } = doneOf(S0);
    const html = R(h(ModuleMenu, { mod: S0, completed: c, quizDone: q, onLesson: noop, embedded: true, topic: { f: { level: "fresh", dueIn: 6 }, gold: { d: "x" }, canGold: true }, acts: { onRefresh: noop, onGold: noop } }));
    const t = tiles(html);
    expect(t.map((x) => x.cls)).toEqual(["tbm-act", "tbm-act gold got"]);
    expect(t[1]).toMatchObject({ title: "Золото · ещё раз", sub: "побей свой рекорд" });
    expect(html).toContain('<span class="tbm-fresh-t"><span>Тема свежая ·</span> <span>ещё 6 дней ·</span> <span>золотая тема</span></span>');
    expect(html).not.toContain("tbm-cellar");   // без onCellar — без кнопки
  });

  it("не пройдена — «Я это умею / зачёт на опыт · 7 заданий»; попытка была — disabled «Зачёт на опыт / новая попытка — завтра»", async () => {
    const { SEASONAL_MODULES } = await import("../data/modules-seasonal");
    const { ModuleMenu } = await import("../ui/module-menu");
    const S1 = SEASONAL_MODULES.find((m) => m.id === "s1");
    let t = tiles(R(h(ModuleMenu, { mod: S1, onLesson: noop, embedded: true, topic: { canCredit: true }, acts: { onCredit: noop } })));
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ cls: "tbm-act", title: "Я это умею", sub: "зачёт на опыт · 7 заданий", icon: true });
    expect(t[0].attrs).not.toContain("disabled");
    t = tiles(R(h(ModuleMenu, { mod: S1, onLesson: noop, embedded: true, topic: { canCredit: true, tried: true }, acts: { onCredit: noop } })));
    expect(t[0]).toMatchObject({ title: "Зачёт на опыт", sub: "новая попытка — завтра" });
    expect(t[0].attrs).toContain('disabled=""');
  });

  it("соседняя страница трека — те же плитки и кнопка, но без фокуса (tabIndex −1); место под печать — то же", async () => {
    const { SEASONAL_MODULES } = await import("../data/modules-seasonal");
    const { ModuleMenu } = await import("../ui/module-menu");
    const S0 = SEASONAL_MODULES.find((m) => m.id === "s0");
    const { c, q } = doneOf(S0);
    delete store.sa_seal_seen;
    const html = R(h(ModuleMenu, { mod: S0, completed: c, quizDone: q, onLesson: noop, embedded: true, passive: true, topic: { f: { level: "faded" }, canGold: true }, acts: { onRefresh: noop, onGold: noop, onCellar: noop } }));
    expect(tiles(html).every((x) => x.attrs.includes('tabindex="-1"'))).toBe(true);
    expect(html).toContain('<button type="button" class="tbm-cellar" tabindex="-1">');
    expect(html).toContain('class="tbm-menu sealed"');   // печать ещё не «опустилась», а отступ уже есть
    expect(html).not.toMatch(/class="tbm-seal[ "]/);
  });

  it("числа — как наберёт App: GOLD_N и CREDIT_N из lib/marks, в маленькой теме — сколько есть, тема из одних вопросов — «вопроса»", async () => {
    const { GOLD_N, CREDIT_N } = await import("../lib/marks");
    expect([GOLD_N, CREDIT_N]).toEqual([8, 7]);
    const { ModuleMenu } = await import("../ui/module-menu");
    const m6 = quizMod("x6", 6);
    const html = R(h(ModuleMenu, { mod: m6, completed: { "x6-1": true }, quizDone: { "x6-q": true }, onLesson: noop, embedded: true, topic: { f: { level: "fresh", dueIn: 3 }, canGold: true }, acts: { onRefresh: noop, onGold: noop } }));
    const t = tiles(html);
    expect(t[0].sub).toBe("3 вопроса · 1 мин");
    expect(t[1].sub).toBe("6 заданий → тема золотая");
    const t5 = tiles(R(h(ModuleMenu, { mod: quizMod("x5", 5), onLesson: noop, embedded: true, topic: { canCredit: true }, acts: { onCredit: noop } })));
    expect(t5[0].sub).toBe("зачёт на опыт · 5 заданий");
  });
});

describe("v40: стили", () => {
  const num = (css, re) => { const m = css.match(re); return m ? parseFloat(m[1]) : NaN; };
  it("плитки: от 56 px, название 15,5 px жирное, подпись 12,5 (светлая 13); две в ряд поровну, до 340 px — столбиком", async () => {
    const { TABLE_CSS } = await import("../ui/table-css");
    expect(TABLE_CSS).toContain(".tbm-actrow{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);");
    expect(TABLE_CSS).toContain("@media (max-width:340px){.tbm-actrow{grid-auto-flow:row}}");
    expect(num(TABLE_CSS, /\.tbm-act\{[^}]*min-height:(\d+)px/)).toBeGreaterThanOrEqual(52);
    expect(TABLE_CSS).toMatch(/\.tbm-act-t\{font-size:15\.5px;font-weight:700/);
    expect(TABLE_CSS).toMatch(/\.tbm-act-s\{font-size:12\.5px/);
    expect(TABLE_CSS).toContain("html.sa-light .tbm-act-s{font-size:13px");
    expect(TABLE_CSS).toMatch(/\.tbm-act-ic\{[^}]*border-radius:50%/);
    // «Погреб тем ›» — капсула 36 px, 14 px; свежесть — 14,5 px курсивом (v73: был моноширинный капс 12,5 px), цвета прежние
    expect(num(TABLE_CSS, /\.tbm-cellar\{[^}]*min-height:(\d+)px/)).toBeGreaterThanOrEqual(36);
    expect(TABLE_CSS).toMatch(/\.tbm-cellar\{[^}]*font:600 14px/);
    expect(TABLE_CSS).toMatch(/\.tbm-fresh\{[^}]*font-style:italic[^}]*font-size:14\.5px[^}]*color:#9C8E70/);
    expect(TABLE_CSS).toContain(".tbm-fresh.fading{color:#C9A35C}.tbm-fresh.faded{color:#D08A6A}.tbm-fresh.upd{color:#8FB0D6}");
    // в светлой теме залитая «Освежить» не теряет заливку (правило светлой плитки сильнее .hot)
    expect(TABLE_CSS).toContain("html.sa-light .tbm-act.hot{background:var(--role-wash");
  });

  it("печать висит над строкой «УРОК N · …»: низ рамки (1 + top + height) выше начала шапки (1 + padding-top)", async () => {
    const { TABLE_CSS } = await import("../ui/table-css");
    const top = num(TABLE_CSS, /\.tbm-seal\{[^}]*top:(-?\d+)px/), h = num(TABLE_CSS, /\.tbm-seal\{[^}]*height:(\d+)px/);
    const pad = num(TABLE_CSS, /\.tbm-menu\.sealed\{[^}]*padding-top:(\d+)px/), mt = num(TABLE_CSS, /\.tbm-menu\.sealed\{margin-top:(\d+)px/);
    expect(1 + top + h).toBeLessThan(1 + pad);
    expect(mt).toBeGreaterThanOrEqual(-top);           // над меню хватает места — край ленты печать не срезает
    // сургуч при любом повороте — в круге радиусом 10,25 из 24 (по контуру WAX_BLOB в ui/table-bits.jsx):
    // у картинки 46 px это 39,3 px — внутри рамки .tbm-seal
    expect(TABLE_CSS).toContain(".tbm-seal svg{display:block;width:46px;height:46px;margin:-3px;transform:rotate(-12deg);");
    expect(46 * 2 * 10.25 / 24).toBeLessThanOrEqual(h);
    expect(TABLE_CSS).toContain(".tbm-seal.stamp svg{animation:tbStamp ");
    expect(TABLE_CSS).toMatch(/@keyframes tbStamp\{0%\{transform:rotate\(-30deg\) scale\(2\.3\);opacity:0\}/);
    expect(TABLE_CSS).toMatch(/prefers-reduced-motion[^}]*\.tbm-seal\.stamp svg/);
  });

  it("живой диалог: карточка гостя и рассказчик крупнее, --fs прежний", () => {
    const src = readFileSync("ui/screens-dialogue.jsx", "utf8");
    const rule = (sel) => { const m = src.match(new RegExp("\\n" + sel.replace(/\./g, "\\.") + "\\{([^}]*)\\}")); return m ? m[1] : ""; };
    expect(rule(".dc-intro-p")).toContain("font-size:16px");
    expect(rule(".dc-chip")).toMatch(/padding:5px 10px;.*font-size:13\.5px/);
    expect(rule(".dc-howto")).toMatch(/font-size:13\.5px;.*color:var\(--sub\)/);
    expect(rule(".dc-svc")).toContain("font-size:15px");
    expect(src).toContain(".dc-ey{${LABEL_CSS};font-size:13.5px");   // v73: курсивом, не моноширинным капсом (в правиле — ${…}, rule() его не разберёт)
    expect(rule(".dc-st")).toContain("font-size:14px");
    expect(rule(".dc-kb-n")).toContain("font-size:12.5px");
    expect(rule(".dc-intro-n")).toContain("font-size:21px");
    expect(rule(".dc-ava.big")).toContain("width:62px;height:62px");
    expect(src).toContain("--track:rgba(120,90,30,0.18);--fs:17px;");    // светлая
    expect(src).toContain("--track:rgba(255,255,255,0.13);--fs:15.5px;"); // тёмная
  });

  it("светлая тема: мелкие подписи трека, стола и чека подняты (подписи ≥ 13 px, метки ≥ 11 px), тёмная — как была", async () => {
    const { TABLE_CSS } = await import("../ui/table-css");
    const { TABLE_LESSON_CSS } = await import("../ui/table-css-lesson");
    const css = TABLE_CSS + TABLE_LESSON_CSS;
    const light = (sel) => num(css, new RegExp("html\\.sa-light " + sel.replace(/\./g, "\\.") + "[,{][^}]*font-size:([\\d.]+)px"));
    for (const s of [".tbm-s", ".tbp-peek span", ".tbp-pin-t", ".tb-host-t span", ".tb-k span", ".tb-myth small", ".tb-autohint", ".tb-heard", ".tb-recap .s", ".r-note", ".r-by", ".r-topics li button"]) expect([s, light(s)]).toEqual([s, 13]);
    for (const s of [".tbm-eyebrow", ".tbm-mk .nm", ".tbm-ck", ".tbm-kchip", ".tbm-foot", ".tbm-sealnote", ".tb-k", ".tb-chip", ".tb-where", ".tb-who", ".tb-spare", ".tb-recap h4", ".r-brand", ".r-stamp", ".r-week small"]) expect([s, light(s) >= 11]).toEqual([s, true]);
    // тёмная — прежние размеры
    expect(TABLE_CSS).toMatch(/\.tbm-eyebrow\{font-family:Georgia[^}]*font-style:italic[^}]*font-size:13px/);   // v73: курсивом
    expect(TABLE_CSS).toMatch(/\.tbm-s\{[^}]*font-size:12px/);
    expect(TABLE_LESSON_CSS).toMatch(/\.tb-who\{[^}]*font-style:italic[^}]*font-size:13px/);   // v58: метки не мельче 10,5 px (было 9,5); v73 — курсив 13 px
    // «пройден» от руки (.tbm-m.tbm-hand) светлые правила не задевают
    expect(TABLE_CSS).not.toMatch(/html\.sa-light \.tbm-m\{/);
  });

  it("погреб тем: в светлой теме подписи 13 px, в тёмной — прежние 11,5 и 12,5", async () => {
    const { SEASONAL_MODULES } = await import("../data/modules-seasonal");
    const { CellarScreen } = await import("../ui/cellar");
    const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {} };
    const S0 = SEASONAL_MODULES.find((m) => m.id === "s0"), S1 = SEASONAL_MODULES.find((m) => m.id === "s1");
    const { c, q } = doneOf(S0);
    const props = { T, modules: [S0, S1], completed: c, quizDone: q, marks: { fresh: { s0: { t: Date.now() - 40 * 864e5, n: 0 } }, credit: {}, gold: {} },
      onBack: noop, onOpenTopic: noop, onRefresh: noop, onGold: noop, onCredit: noop, onFreshAll: noop, onProbe: noop, probeCount: 2 };
    const lt = R(h(CellarScreen, { ...props, a11y: true })), dk = R(h(CellarScreen, { ...props, a11y: false }));
    expect(lt).not.toMatch(/font-size:(11\.5|12\.5)px|font:700 12\.5px/);
    expect(lt).toMatch(/font-size:13px/);
    expect(dk).toMatch(/font-size:11\.5px/);
    expect(dk).toMatch(/font:700 12\.5px Georgia/);
  });
});
