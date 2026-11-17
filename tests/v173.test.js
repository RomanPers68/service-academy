// v173 (Доп. 498): серая плашка в поиске. Владелец (17.11): «Заметил артефакт в поиске, когда пишешь а после скролишь.
// На записи видно.» На записи набрано «Эсп», клавиатура iPhone предлагает замену на «Эми» и подсвечивает слово в поле;
// экран листается внутри #root, системная подсветка за полем не едет и остаётся висеть поверх списка.
//   • lib/search-field.js: свойства строки поиска: без автозамены и подчёркивания, клавиша «Найти» убирает клавиатуру;
//   • двадцать строк поиска в ui/*.jsx берут их одной вставкой {...SEARCH_ATTRS}; «Найти…» в графике: NO_AUTOCORRECT;
//   • обычные поля (сообщение в чате, название главы) не тронуты: там автозамена нужна.
// Сервер не меняется. Разметки JSX в файле нет (Доп. 482). Вид в браузере: tools/claude/e2e-v173.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store0 = {};
const phone = { getItem: (k) => (k in store0 ? store0[k] : null), setItem: (k, v) => { store0[k] = String(v); }, removeItem: (k) => { delete store0[k]; } };
globalThis.localStorage = phone;
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { SEARCH_ATTRS, NO_AUTOCORRECT, searchKeyDown, touchKeyboard } from "../lib/search-field.js";
import { SearchScreen } from "../ui/search";
import { SearchField } from "../ui/bar-kit";
import { S } from "../ui/styles";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const count = (s, part) => s.split(part).length - 1;

// окно с пальцем (телефон) и с мышью (компьютер)
const winOf = (coarse) => ({ matchMedia: (q) => ({ matches: q === "(pointer: coarse)" ? coarse : false }) });
const field = () => { const el = { n: 0, blur() { el.n++; } }; return el; };

// все теги <input …/> файла: текст тега целиком (фигурные скобки внутри учитываются)
function inputs(src) {
  const out = [];
  let i = -1;
  while ((i = src.indexOf("<input", i + 1)) >= 0) {
    if (/[A-Za-z0-9_]/.test(src[i + 6] || "")) continue;
    let depth = 0, end = -1;
    for (let j = i; j < src.length; j++) {
      const c = src[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (depth === 0 && src.startsWith("/>", j)) { end = j + 2; break; }
    }
    if (end > 0) out.push(src.slice(i, end));
  }
  return out;
}
const UI = readdirSync("ui").filter((f) => /\.jsx$/.test(f)).map((f) => "ui/" + f).concat(["App.jsx"]);
const TAGS = UI.flatMap((f) => inputs(rd(f)).map((tag) => ({ f, tag })));
// строка поиска по виду: type="search" либо подсказка или подпись с «Найти», «Поиск»
const looksLikeSearch = (tag) => /type="search"/.test(tag) || /(placeholder|aria-label)=(\{[^}]*)?"(Найти|Поиск)/.test(tag);

describe("v173 · версия и журнал", () => {
  it("сборка v173, Дополнение 498, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(173);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 498 — .*\(v173\)/);
    const part = c.slice(c.indexOf("# Дополнение 498")).replace(/\s+/g, " ");
    for (const w of ["Заметил артефакт в поиске, когда пишешь а после скролишь", "На записи видно"]) expect(part, w).toContain(w);
    for (const line of c.slice(c.indexOf("# Дополнение 498")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v173.mjs");
  });
});

describe("v173 · свойства строки поиска", () => {
  it("без автозамены и без подчёркивания; клавиша ввода подписана «Найти»", () => {
    expect(NO_AUTOCORRECT).toEqual({ autoCorrect: "off", spellCheck: false });
    expect(SEARCH_ATTRS.autoCorrect).toBe("off");
    expect(SEARCH_ATTRS.spellCheck).toBe(false);
    expect(SEARCH_ATTRS.enterKeyHint).toBe("search");
    expect(typeof SEARCH_ATTRS.onKeyDown).toBe("function");
    // заглавную букву в начале не трогаем: «Эспрессо» в недавних запросах остаётся с большой
    expect(Object.keys(SEARCH_ATTRS).sort()).toEqual(["autoCorrect", "enterKeyHint", "onKeyDown", "spellCheck"]);
  });

  it("клавиатура на экране: палец как основной указатель", () => {
    expect(touchKeyboard(winOf(true))).toBe(true);
    expect(touchKeyboard(winOf(false))).toBe(false);
    expect(touchKeyboard({})).toBe(false);                                         // старый браузер без matchMedia
    expect(touchKeyboard({ matchMedia: () => { throw new Error("нет"); } })).toBe(false);
    expect(touchKeyboard({ matchMedia: () => null })).toBe(false);
  });

  it("«Найти» на телефоне убирает клавиатуру, на компьютере поле остаётся в работе", () => {
    const a = field();
    expect(searchKeyDown({ key: "Enter", currentTarget: a }, winOf(true))).toBe(true);
    expect(a.n).toBe(1);
    const b = field();
    expect(searchKeyDown({ key: "Enter", currentTarget: b }, winOf(false))).toBe(false);
    expect(b.n).toBe(0);
  });

  it("другие клавиши и набор с подсказками клавиатуры поле не трогают", () => {
    for (const key of ["a", "Э", " ", "Escape", "Backspace", "Tab", "ArrowDown"]) {
      const el = field();
      expect(searchKeyDown({ key, currentTarget: el }, winOf(true)), key).toBe(false);
      expect(el.n, key).toBe(0);
    }
    const el = field();
    expect(searchKeyDown({ key: "Enter", isComposing: true, currentTarget: el }, winOf(true))).toBe(false);
    expect(el.n).toBe(0);
  });

  it("убирает клавиатуру у самого поля; пустое событие не роняет экран", () => {
    const own = field(), inner = field();
    searchKeyDown({ key: "Enter", currentTarget: own, target: inner }, winOf(true));
    expect([own.n, inner.n]).toEqual([1, 0]);
    const only = field();
    expect(searchKeyDown({ key: "Enter", target: only }, winOf(true))).toBe(true);
    expect(only.n).toBe(1);
    expect(searchKeyDown(null, winOf(true))).toBe(false);
    expect(searchKeyDown(undefined)).toBe(false);
    expect(searchKeyDown({ key: "Enter" }, winOf(true))).toBe(false);
    expect(searchKeyDown({ key: "Enter", currentTarget: {} }, winOf(true))).toBe(false);
    expect(() => SEARCH_ATTRS.onKeyDown({ key: "Enter", currentTarget: field() })).not.toThrow();
    expect(SEARCH_ATTRS.onKeyDown({ key: "Enter", currentTarget: field() })).toBe(undefined);
  });
});

describe("v173 · экран «Поиск» и поле карты бара", () => {
  const attrsOf = (html) => { const m = /<input[^>]*>/.exec(html); return m ? m[0] : ""; };

  it("поле «Поиска»: автозамены нет, подчёркивания нет, клавиша «Найти»; вид прежний", () => {
    const html = R(h(SearchScreen, { T: S, a11y: false, role: { id: "waiter" }, modules: [], profile: { restaurant: "Два моря, Океан" }, onOpen() {}, onBack() {} }));
    const tag = attrsOf(html);
    expect(tag).toMatch(/autocorrect="off"/i);
    expect(tag).toMatch(/spellcheck="false"/i);
    expect(tag).toMatch(/enterkeyhint="search"/i);
    expect(tag).toContain('placeholder="Блюдо, аллерген, вино, коктейль…"');
    expect(tag).toContain('data-lens-field=""');
    expect(tag).toContain("font-size:16px");                                        // 16 px: iPhone не приближает экран при вводе
    expect(tag).not.toMatch(/autocapitalize/i);
    expect(html).toContain("Введи минимум 2 буквы.");
  });

  it("поле поиска «Барной карты» и винной карты: то же", () => {
    const tag = attrsOf(R(h(SearchField, { value: "", onChange() {}, placeholder: "Коктейль или ингредиент", aria: "Поиск по коктейлям", a11y: false, gold: "#C8A96E", text: "#F5EFE2" })));
    expect(tag).toMatch(/autocorrect="off"/i);
    expect(tag).toMatch(/spellcheck="false"/i);
    expect(tag).toMatch(/enterkeyhint="search"/i);
    expect(tag).toContain('type="search"');
    expect(tag).toContain('aria-label="Поиск по коктейлям"');
  });
});

describe("v173 · все строки поиска приложения", () => {
  const withAttrs = TAGS.filter((t) => t.tag.includes("{...SEARCH_ATTRS}"));

  it("каждое поле, похожее на поиск, берёт общие свойства", () => {
    const found = TAGS.filter((t) => looksLikeSearch(t.tag));
    expect(found.length).toBeGreaterThanOrEqual(14);
    for (const t of found) expect(t.tag, t.f + ": " + t.tag.slice(0, 120)).toContain("{...SEARCH_ATTRS}");
  });

  it("и строки поиска с подсказкой без слова «Найти»: «Поиск», меню, колоды, вина", () => {
    const want = [
      ["ui/search.jsx", 'placeholder="Блюдо, аллерген, вино, коктейль…"'],
      ["ui/menu-deck.jsx", 'placeholder="Блюдо, ингредиент, аллерген…"'],
      ["ui/menu-trainer.jsx", 'placeholder="Блюдо, ингредиент, аллерген…"'],
      ["ui/cocktails.jsx", 'placeholder="Название, ингредиент или бокал…"'],
      ["ui/wine-train.jsx", "placeholder={K.t.deckPh}"],
      ["ui/wine-editor.jsx", "placeholder={K.t.findOne}"],
      ["ui/bar-kit.jsx", 'data-bar-search=""'],
      ["ui/golist.jsx", 'data-go-search=""'],
      ["ui/newbie.jsx", 'data-nb-search=""'],
      ["ui/chat.jsx", 'data-chat-q=""'],
      ["ui/chat.jsx", 'data-chat-search=""'],
      ["ui/chat-cards.jsx", 'data-chat-picksearch=""'],
      ["ui/content-editor.jsx", "setCkQuery(e.target.value)"],
      ["ui/screens-learning.jsx", 'placeholder="Поиск термина..."'],
      ["ui/screens-team.jsx", 'placeholder="Поиск по имени или ресторану..."'],
      ["ui/screens-gamification.jsx", 'placeholder="Найти сотрудника"'],
      ["ui/pronounce.jsx", 'placeholder="Найти: шардоне, burrata, апероль…"'],
      ["ui/report.jsx", 'aria-label="Найти сотрудника по имени"'],
      ["ui/together.jsx", 'placeholder="Найти коллегу"'],
      ["ui/menu-trainer.jsx", 'placeholder="Найти блюдо в редакторе…"'],
    ];
    for (const [f, mark] of want) {
      const hit = TAGS.filter((t) => t.f === f && t.tag.includes(mark));
      expect(hit.length, f + " " + mark).toBe(1);
      expect(hit[0].tag, f + " " + mark).toContain("{...SEARCH_ATTRS}");
    }
    expect(withAttrs.length).toBe(want.length);
  });

  it("общие свойства стоят в теге последними, своей клавиши ввода у поля нет", () => {
    for (const t of withAttrs) {
      expect(t.tag.replace(/\s+/g, " "), t.f).toMatch(/\{\.\.\.SEARCH_ATTRS\} \/>$/);   // последними: их не перебить случайно
      expect(count(t.tag, "onKeyDown="), t.f).toBe(0);                                  // иначе «Найти» молча пропадёт
      expect(count(t.tag, "{...SEARCH_ATTRS}"), t.f).toBe(1);
    }
    // файл, который берёт свойства, подключает их из lib/search-field
    for (const f of new Set(withAttrs.map((t) => t.f))) expect(rd(f), f).toContain('import { SEARCH_ATTRS } from "../lib/search-field";');
  });

  it("«Найти по имени или должности» в графике: без автозамены, «Готово» на клавиатуре прежнее", () => {
    const s = rd("ui/schedule.jsx");
    expect(s).toContain('import { NO_AUTOCORRECT } from "../lib/search-field";');
    expect(s).toContain("{...(find ? NO_AUTOCORRECT : null)} />");
    expect(s).toContain('v={empFilter} find\n          placeholder="Найти по имени или должности…" set={setEmpFilter} />');
    expect(s).toContain('enterKeyHint="done" onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}');
    expect((s.match(/<Text\b[^\n]*\sfind(\s|\/|$)/gm) || []).length).toBe(1);        // остальные поля графика: как были
  });

  it("обычные поля не тронуты: там пишут текст, автозамена нужна", () => {
    // без автозамены, кроме строк поиска: поле графика с признаком find, код приглашения («Команда»), ссылка на карты («Спасибо»)
    const other = TAGS.filter((t) => /NO_AUTOCORRECT|autoCorrect=/.test(t.tag) && !t.tag.includes("SEARCH_ATTRS")).map((t) => t.f).sort();
    expect(other).toEqual(["ui/schedule.jsx", "ui/screens-team.jsx", "ui/thanks.jsx"]);
    const chat = rd("ui/chat.jsx");
    const composer = chat.slice(chat.indexOf('data-chat-input=""') - 400, chat.indexOf('data-chat-input=""') + 300);
    expect(composer).not.toMatch(/SEARCH_ATTRS|autoCorrect|spellCheck/);
    for (const f of ["ui/ref-editor.jsx", "ui/ref-split.jsx", "ui/cocktail-editor.jsx", "ui/cases.jsx", "ui/guest-thanks.jsx"]) expect(rd(f), f).not.toMatch(/search-field/);
  });

  it("в lib/search-field.js объяснено, откуда плашка, и нет слов интерфейса", () => {
    const s = rd("lib/search-field.js");
    expect(s).toContain("Заметил артефакт в поиске, когда пишешь а после скролишь");
    expect(s).toContain("#root");
    expect(s).toContain('"(pointer: coarse)"');
    expect(s).not.toMatch(/document\.|localStorage/);
  });
});
