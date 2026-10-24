// v78 (Доп. 391): правки вида по «мягкому наброску», который владелец выбрал вместо «без блеска»: золото, стекло и
// свечения остаются; уходят повторяющиеся приёмы раскладки — плашка-квадрат под значком в списках разделов и у курсов
// Справочника, метки «Курс» и «Колода» над названиями, слоганы под названиями экранов («Всё для рабочего дня»),
// цепочки через «·» в подписях разделов; заставка до загрузки — без звёздочки ✦. Ряд нулей у новичка не трогаем:
// в самый первый день вместо него уже стоит строка «Первый день» (v56). Вид — tools/claude/e2e-v78.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

describe("v78: заставка до загрузки — без звёздочки", () => {
  it("в index.html нет ✦: заставка и экран «Не удалось запустить» — «SA»", () => {
    const html = rd("index.html");
    expect(html).not.toContain("✦");
    expect(html).toContain('<div id="sa-splash"><div class="mark">SA</div></div>');
    expect(html).toContain(`'<div style="font-size:15px;letter-spacing:5px;margin-bottom:14px">SA</div>' +`);
  });
});

describe("v78: значки в списках — без плашек", () => {
  it("разделы «Смены», «Команды» и «Я»: значок без квадрата (ни фона, ни рамки); карточка — прежняя", () => {
    const src = code(rd("ui/home-hubs.jsx"));
    expect(src).toContain('<div data-hub-ic="" style={{ width: 32, height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>');
    expect(src).not.toContain('width: 44, height: 44, borderRadius: 14');
    expect(src).not.toContain('background: a11y ? "rgba(139,106,48,0.10)" : "rgba(214,178,102,0.10)", border: `1px solid ${c}44`');
    // стекло карточки «Морозный след» — как было (владелец оставил блеск)
    expect(src).toContain('"inset 0 0 26px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.45)"');
  });
  it("курсы Справочника: витраж без плашки-квадрата", () => {
    const src = code(rd("ui/reference-art.jsx"));
    expect(src).toContain('<div data-ref-art={kind} style={{ width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>');
    expect(src).not.toContain("borderRadius: 14, background: light ?");
    expect(src).not.toContain("inset 0 0 14px");
  });
});

describe("v78: Справочник — без меток «Курс» и «Колода», подписи без «·»", () => {
  it("метка над названием — только «Скоро» у закрытого курса", () => {
    const src = code(rd("ui/ReferenceSection.jsx"));
    expect(src).not.toContain('"Колода" : c.on ? "Курс"');
    expect(src).toContain('{c.tag || !c.on ? <div style={{ ...T.modTag, ...labelStyle(a11y ? 15 : 13), color: gold }}>{c.tag || "Скоро"}</div> : null}');
  });
  it("«6 глав с фото», «7 глав со схемами», «56 коктейлей: состав, метод и история»", async () => {
    const src = code(rd("ui/ReferenceSection.jsx"));
    expect(src).toContain('s: `${chapters} ${plural(chapters)} с фото`');
    expect(src).toContain('s: `${coffeeChapters} ${plural(coffeeChapters)} со схемами`');
    expect(src).toContain(': состав, метод и история`');
    expect(src).not.toContain("состав, метод, история · основы бара");
    const { COCKTAILS } = await import("../data/cocktails.js");
    const word = ((n) => n % 10 === 1 && n % 100 !== 11 ? "коктейль" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "коктейля" : "коктейлей")(COCKTAILS.length);
    expect(COCKTAILS.length + " " + word).toBe("56 коктейлей");
  });
});

describe("v78: вкладки — без слоганов, подписи разделов обычной фразой", () => {
  it("«Смена» и «Команда» без подзаголовка-слогана; у «Я» — ресторан, как было", () => {
    const app = code(rd("App.jsx"));
    for (const s of ["Всё для рабочего дня", "Люди, цифры и найм", "Рейтинг и наставничество"]) expect([s, app.includes(s)]).toEqual([s, false]);
    expect(app).toContain('title={profile.name} subtitle={profile.restaurant || "Service Academy"}');
  });
  it("«Отчёты», «Лига недели», «Погреб тем» — без перечней через «·»", () => {
    const app = code(rd("App.jsx"));
    expect(app).toContain('sub:"Кто где ошибается и что не прошёл, в Excel и PDF"');
    expect(app).toContain('sub: leagueSub(brief) || "Очки за занятия с понедельника: в заведении и в сети"');
    expect(app).toContain('return (f ? f + " " + pl3(f, "тема выдыхается", "темы выдыхаются", "тем выдыхаются") : "Всё свежее") + (g ? ", золотых " + g : ""); })(),');
    for (const s of ["освежить, раунд мастера, зачёт", "заведение, сеть и кубок", "· Excel и PDF"]) expect([s, app.includes(s)]).toEqual([s, false]);
  });
});

describe("v78: метка и журнал", () => {
  it("«сборка v78», «Дополнение 391»", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v78</span>");
    expect(rd("CHANGES.md")).toContain("# Дополнение 391 — вид без шаблонных приёмов: значки без плашек, без меток и слоганов (v78)");
  });
});
