// v130 (Доп. 443): «Барная карта» — печать, как у меню, и «Поделиться в чат». Владелец (02.11): «Давай в барную карту
// добавим возможность распечатать информацию. Имею ввиду, как в меню» — на восемь предложений «Да, давай все»; и «нужна ещё
// функция «поделиться в чат». В колоде коктейлей вроде и есть. А вот вина и крепкие не имеют такой возможности».
// lib/bar-print.js (что на листе и в тексте, страницы под А4), ui/bar-print.jsx (экран и холст), ui/bar-kit.jsx («Печать»,
// «Поделиться в чат»), ui/bar-card.jsx, ui/wine-list.jsx, lib/share-items.js, чат (ui/chat-cards.jsx, ui/chat.jsx,
// lib/chat-smart.js), App.jsx, supabase/supabase-stage46-bar-share.sql (сверка с сервером демо — tools/claude/pg-check-stage46.mjs);
// e2e — tools/claude/e2e-v130.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import * as W from "../lib/wine.js";
import * as Sp from "../lib/spirit.js";
import { WINE, SPIRIT } from "../lib/drinks.js";
import { COCKTAILS } from "../data/cocktails.js";
import { PRINT_KINDS, KIND_RU, cocktailRow, drinkRow, printSections, printText, paginate, rowsCount, posWord, PAGE } from "../lib/bar-print.js";
import { drinkShareItem, cocktailShareItem, dishShareItem } from "../lib/share-items.js";
import { cardSummary } from "../lib/chat-smart.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";
import { STAGES } from "../lib/server-check.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const nb = (s) => String(s).replace(/ /g, " ");
const T = { screen: {}, modCard: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modArrow: {}, para: {}, doneBtn: {} };
const strip = (html) => html.replace(/<!-- -->/g, "");

const CHA = W.normWine({ name: "Шабли / Chablis", producer: "Domaine Laroche", country: "Франция", region: "Бургундия", grapes: ["шардоне"], color: "white", sweet: "сухое", vintage: "2022", abv: 12.5,
  byGlass: true, priceGlass: 950, priceBottle: 5200, temp: "8–10 °C", glass: "бургундия", volume: "0,75 л", notes: ["зелёное яблоко", "мел"], short: "Свежее и минеральное.",
  pair: ["d-oys", "d-none"], pairNote: "К устрицам и тартару.", img: "https://photos.e2e/cha.jpg", stop: { since: 1 } }, { id: "w-cha" });
const ROS = W.normWine({ name: "Розе", country: "Франция", region: "Прованс", grapes: ["гренаш"], color: "rose", sweet: "сухое", byGlass: true, priceBottle: 5900, notes: ["клубника"], short: "Бледное." },
  { id: "w-ros", ai: ["grapes", "notes"] });
const OLD = W.normWine({ name: "Старое", color: "red", archived: true }, { id: "w-old" });
const CAM = Sp.normSpirit({ name: "Campari", cat: "bitter", style: "аперитив", country: "Италия", abv: 25, portion: 40, pricePortion: 400, serve: ["со льдом", "в коктейле"], glass: "рокс", notes: ["горький апельсин"] }, { id: "sp-cam" });
const BEE = Sp.normSpirit({ name: "Beefeater", cat: "gin", style: "London Dry", country: "Великобритания", abv: 40 }, { id: "sp-bee" });
const NEG = COCKTAILS.find((c) => c.id === "negroni");
const HOUSE = { id: "ck-sea", house: true, name: "Морской бриз по-нашему", glass: "highball", method: "билд", ing: [["Водка", 40, "мл"], ["Клюквенный морс", 90, "мл"], ["Содовая", 50, "доверху"], ["Лайм", ""]], steps: ["Лёд в хайбол", "Водка и морс"], short: "Клюква и водка.", tip: "Подавать сразу", stop: { since: 1 } };
const ctx = { cocktails: [NEG, HOUSE], spirits: [BEE, CAM], dishName: (id) => ({ "d-oys": "Устрицы" })[id] || "" };

describe("v130: что на листе", () => {
  it("вино — как в карточке: название с годом и оригинал, производитель, откуда, сорт, стиль, крепость, цена, ноты, подача, гостю, к блюдам; стопа нет", () => {
    const r = drinkRow(WINE, CHA, ctx);
    expect([r.kind, r.id, r.title, r.orig, r.meta, r.img, r.art]).toEqual(["wine", "w-cha", "Шабли 2022", "Chablis", "Domaine Laroche", "https://photos.e2e/cha.jpg", null]);
    expect(r.lines.map(([k, t]) => k + ": " + nb(t))).toEqual([
      "line: Франция, Бургундия · шардоне · белое сухое · 12,5%", "price: бокал 950 ₽ · бутылка 5 200 ₽", "dim: Ноты: зелёное яблоко, мел",
      "dim: Подача: 8–10 °C · бокал «бургундия» · 0,75 л", "guest: Гостю: «Свежее и минеральное.»", "faint: К блюдам: Устрицы", "faint: К устрицам и тартару."]);
    expect(JSON.stringify(r)).not.toMatch(/сегодня нет/);
    // бокалом без цены бокала — так и сказано; дописанное AI — «Не проверено: …»
    const ro = drinkRow(WINE, ROS, ctx);
    expect(nb(ro.lines.find(([k]) => k === "price")[1])).toBe("бокалом · бутылка 5 900 ₽");
    expect(ro.lines[ro.lines.length - 1]).toEqual(["warn", "Не проверено: сорт, ноты"]);
  });
  it("крепкое — то же и «В коктейлях: …» нашего бара; коктейль — состав с граммовкой, рецепт, крепкое из нашей карты, гостю, «свой»", () => {
    const c = drinkRow(SPIRIT, CAM, ctx);
    expect(c.lines.map(([k, t]) => k + ": " + nb(t))).toEqual(["line: Италия · биттер, аперитив · 25%", "price: 40 мл 400 ₽", "dim: Ноты: горький апельсин",
      "dim: Подача: со льдом, в коктейле · бокал «рокс»", "faint: В коктейлях: Негрони"]);
    const n = cocktailRow(NEG, ctx);
    expect([n.kind, n.title, n.tag, n.meta, n.art === NEG]).toEqual(["cocktail", "Негрони", "", "стир · Рокс · Цедра апельсина", true]);
    expect(n.lines.map(([k, t]) => k + ": " + nb(t))).toEqual(["line: Джин 30 мл · Кампари 30 мл · Красный вермут 30 мл",
      "dim: Как готовить: " + NEG.steps.map((x, i) => i + 1 + ". " + x).join("  →  "),
      "faint: Из нашей карты: Beefeater, Campari", "guest: Гостю: «Три равные части, горьковатый и честный. Аперитив, который открыл сто лет назад итальянский граф»"]);
    expect(n.lines[0][1]).toContain("30 мл");   // число и «мл» не разъедутся по строкам
    const h = cocktailRow(HOUSE, ctx);
    expect([h.tag, nb(h.lines[0][1]), h.lines[1][1], h.lines[h.lines.length - 1][1]]).toEqual(["свой", "Водка 40 мл · Клюквенный морс 90 мл · Содовая доверху · Лайм", "Как готовить: 1. Лёд в хайбол  →  2. Водка и морс", "Гостю: «Клюква и водка.»"]);
    expect(JSON.stringify([n, h])).not.toMatch(/Подача|К столу|сегодня нет/);   // как договорились: без подачи и «к столу»
  });
  it("разделы как в карте, архив не печатается; текстом — тот же лист для чата", () => {
    const s = printSections("wine", [ROS, OLD, CHA], ctx);
    expect(s.map((x) => [x.key, x.label, x.rows.map((r) => r.id)])).toEqual([["white", "Белые", ["w-cha"]], ["rose", "Розовые", ["w-ros"]]]);
    expect(printSections("spirit", [CAM, BEE], ctx).map((x) => x.label)).toEqual(["Джин", "Биттеры и настойки"]);
    expect(printSections("cocktail", [NEG, HOUSE], ctx).map((x) => [x.label, x.rows.map((r) => r.id)])).toEqual([["Джин", ["negroni"]], ["Водка", ["ck-sea"]]]);
    expect([rowsCount(s), posWord(1), posWord(3), posWord(11), posWord(22)]).toEqual([2, "1 позиция", "3 позиции", "11 позиций", "22 позиции"]);
    expect([PRINT_KINDS.map(([k]) => k), KIND_RU.wine]).toEqual([["cocktail", "wine", "spirit"], "Вина"]);
    const t = printText({ restaurant: "Два моря", parts: [{ label: "Вина: Бокалом", sections: s }], date: new Date(2026, 10, 2) });
    expect(t.startsWith("БАРНАЯ КАРТА · ДВА МОРЯ\n02.11.2026\n\n\nВИНА: БОКАЛОМ · 2 ПОЗИЦИИ\n\nБЕЛЫЕ\n\nШабли 2022 (Chablis)\nDomaine Laroche\nФранция, Бургундия · шардоне · белое сухое · 12,5%\nбокал 950 ₽ · бутылка 5 200 ₽\n")).toBe(true);
    expect(t).toContain("\n\nРОЗОВЫЕ\n\nРозе\n");
    expect(t).not.toMatch(/ /);
  });
});

describe("v130: страницы под А4", () => {
  it("лист 760 × 1074 — чуть меньше √2: печатается на А4 и не переползает на вторую страницу", () => {
    expect([PAGE.W, PAGE.H, PAGE.H / PAGE.W < Math.SQRT2, Math.SQRT2 - PAGE.H / PAGE.W < 0.002]).toEqual([760, 1074, true, true]);
  });
  it("позиция целиком на одной странице; заголовок раздела — в начале страницы и там, где раздел сменился", () => {
    const rows = [{ h: 300, sec: "А" }, { h: 300, sec: "А" }, { h: 300, sec: "Б" }, { h: 300, sec: "Б" }, { h: 1200, sec: "В" }, { h: 100, sec: "В" }];
    const p = paginate(rows, 920, 22);
    // 22 + 300 + 300 = 622; + 22 + 300 = 944 > 920 → новая; Б: 22 + 300 + 300 = 622; выше страницы — одна; потом 22 + 100
    expect(p.map((pg) => pg.map((r) => r.sec + r.h))).toEqual([["А300", "А300"], ["Б300", "Б300"], ["В1200"], ["В100"]]);
    expect(paginate([], 920, 22)).toEqual([]);
    expect(paginate(Array.from({ length: 10 }, () => ({ h: 100, sec: "А" })), 920, 22).map((x) => x.length)).toEqual([8, 2]);
  });
});

describe("v130: экран печати", () => {
  it("«Барная карта для печати»: что печатать со счётом, «Только показанные», фото, кнопки как у меню", async () => {
    const { BarPrint } = await import("../ui/bar-print.jsx");
    const html = strip(renderToString(React.createElement(BarPrint, { T, a11y: false, restaurant: "Два моря", cocktails: [NEG, HOUSE], wines: [CHA, ROS], spirits: [CAM, BEE],
      start: { kind: "wine", ids: ["w-cha"], label: "Бокалом" }, onBack: () => {} })));
    for (const s of ["Барная карта · экспорт", "Барная карта для печати", "Что печатать", 'data-bar-print="wine"', 'data-bar-print-n="1"', ">Коктейли · 2<", ">Вина · 2<", ">Крепкое · 2<", ">Вся карта · 6<",
      'data-bar-print-scope="shown"', ">Только показанные: Бокалом, 1<", ">Все 2<", 'data-bar-print-photo="on"', ">С фото бутылок ✓<", ">Картинкой<", ">Текстом<", ">Печать<",
      "Позиций: 1. Страницы под А4: сохраняются в галерею и уходят в любой мессенджер, коды входа не нужны. «Печать» откроет системный диалог: принтер или PDF."]) expect(html, s).toContain(s);
    // без фото в выбранном — переключателя нет; одна вкладка — без «Вся карта»
    const h2 = strip(renderToString(React.createElement(BarPrint, { T, a11y: true, restaurant: "", cocktails: [NEG], wines: [], spirits: [], start: { kind: "cocktail" }, onBack: () => {} })));
    expect([h2.includes("data-bar-print-photo"), h2.includes("Вся карта"), h2.includes("data-bar-print-scope"), h2.includes(">Коктейли · 1<")]).toEqual([false, false, false, true]);
    const P = rd("ui/bar-print.jsx");
    for (const s of ['data-lens-btn="main" data-bar-print-go=""', 'data-lens-btn="soft" data-bar-print-text=""', 'data-lens-btn="soft" data-lens-ink="" data-bar-print-sys=""', "{!tg ? <button",
      "window.Telegram.WebApp.initData", "body>*:not(#sa-bar-print){display:none!important}", "@page{size:A4;margin:0}", 'createPortal(<div id="sa-bar-print"', 'img.crossOrigin = "anonymous"',
      "С фото не вышло. Собрал без них", "items.forEach((sh, i) => setTimeout(() => save(sh), i * 350))", "document.body.appendChild(a); a.click(); a.remove();",
      "import { GLASS } from \"./cocktail-art\""]) expect(P, s).toContain(s);
    expect(rd("ui/cocktail-art.jsx")).toContain("export const GLASS = {");
  });
  it("«Печать» в строке под вкладками у всех вкладок: вкладка и что на ней показано; «назад» — туда же", () => {
    const L = rd("ui/wine-list.jsx"), B = rd("ui/bar-card.jsx"), K = rd("ui/bar-kit.jsx");
    for (const s of ["export function PrintLink(", 'data-bar-print-open=""', "Печать</button>", "export function ShareChat(", "Поделиться в чат</button>", 'import { CHAT_SHARE_IC } from "./share-chat"']) expect(K, s).toContain(s);
    expect(L).toContain('onPrint(filtered && shown.length ? { kind: K.kind, ids: shown.map((x) => x.id), label: [onlyLabel, qt ? "по запросу «" + qt + "»" : "", pickN ? "фильтр" : ""].filter(Boolean).join(", ") } : { kind: K.kind });');   // v136: «Подобрать гостю» стало «Фильтр»
    expect(B).toContain('onPrint(filtered && shownN ? { kind: "cocktail", ids: shown.flatMap(([, l]) => l.map((x) => x.id)),');
    expect(B).toContain("if (print) return <BarPrint T={T} a11y={a11y} restaurant={restaurant} cocktails={cocktails} wines={wines} spirits={spirits} start={print} onBack={() => { vibrate(\"light\"); setPrint(null); }} />;");
    expect((B.match(/onPrint=\{setPrint\} onShareChat=\{onShareChat\}/g) || []).length).toBe(2);
  });
});

describe("v130: «Поделиться в чат» — вина и крепкое", () => {
  it("карточка: название с годом или выдержкой, откуда и цена (до 110), фото — только https; коктейль и блюдо — как были", () => {
    const w = drinkShareItem(WINE, CHA);
    expect([w.kind, w.id, w.title, nb(w.sub), w.img]).toEqual(["wine", "w-cha", "Шабли 2022", "Франция, Бургундия · шардоне · белое сухое · бокал 950 ₽ · бутылка 5 200 ₽", "https://photos.e2e/cha.jpg"]);
    expect(drinkShareItem(WINE, { ...CHA, img: "data:image/png;base64,AAAA" }).img).toBe("");
    const s = drinkShareItem(SPIRIT, Sp.normSpirit({ name: "Glenfiddich", age: "12 лет", cat: "whisky", country: "Шотландия", region: "Спейсайд", abv: 40, portion: 40, pricePortion: 650, priceBottle: 9800 }, { id: "sp-gle" }));
    expect([s.kind, s.title, nb(s.sub)]).toEqual(["spirit", "Glenfiddich 12 лет", "Шотландия, Спейсайд · виски · 40% · 40 мл 650 ₽ · бутылка 9 800 ₽"]);
    expect(drinkShareItem(WINE, { ...CHA, region: "Очень длинный регион ".repeat(8) }).sub.length).toBeLessThanOrEqual(110);
    expect([cocktailShareItem(NEG).kind, dishShareItem({ id: "d1", name: "Устрицы", cat: "Закуски", ingredients: ["устрица (3 шт)"] }).sub]).toEqual(["cocktail", "Закуски · устрица"]);
  });
  it("в чате — «Вино: …» и «Крепкое: …», «Открыть в Барной карте»; открывается карточка в «Барной карте» (и когда она уже на экране)", () => {
    expect([cardSummary({ t: "share", item: { kind: "wine", title: "Шабли 2022" } }), cardSummary({ t: "share", item: { kind: "spirit", title: "Campari" } }),
      cardSummary({ t: "share", item: { kind: "cocktail", title: "Негрони" } })]).toEqual(["Вино: Шабли 2022", "Крепкое: Campari", "Коктейль: Негрони"]);
    const C = rd("ui/chat-cards.jsx");
    for (const s of ['wine: ["Вино", IC.wine], spirit: ["Крепкое", IC.spirit]', 'wine: "Открыть в Барной карте", spirit: "Открыть в Барной карте"']) expect(C, s).toContain(s);
    expect(rd("ui/chat-kit.jsx")).toMatch(/ {2}wine: svg\(/);
    expect(rd("ui/chat-kit.jsx")).toMatch(/ {2}spirit: svg\(/);
    const A = rd("App.jsx");
    expect(A).toContain('if (k === "wine" || k === "spirit") { setBarBack(null); setBarNote(""); setWineStart(id); setBarTab(k); setBarOpenN((n) => n + 1); navigate("wines"); return; }');
    expect(A).toContain('<BarCardScreen key={"bar" + barOpenN} onShareChat={chatShare}');
    expect(rd("ui/chat.jsx")).toContain("Вина и крепкое в чат пойдут после обновления сервера: этап 46 (supabase-stage46-bar-share.sql). Блюда и коктейли уже можно.");
    expect(rd("ui/wine-list.jsx")).toContain('<ShareChat id={K.kind + ":" + w.id} onClick={() => onShareChat(drinkShareItem(K, w))}');
    expect(rd("ui/bar-card.jsx")).toContain('<ShareChat id={"cocktail:" + c.id} onClick={() => onShareChat(cocktailShareItem(c))}');
  });
  it("сервер демо — как этап 46: вино и крепкое в чат заведения, не в сетевой; без этапа (noStage46) — bad_request", () => {
    const PEOPLE = [{ id: "u-maria", name: "Мария", surname: "Ким", restaurant: "Р", position: "manager", is_admin: false }];
    const mk = (noStage46) => makeServer({ today: "2026-11-02", rest: "Р", people: PEOPLE, tok: { t1: "u-maria" }, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, noStage46 });
    const card = { t: "share", item: drinkShareItem(WINE, CHA) };
    const a = mk(false).rpc("chat_card_send", { p_token: "t1", p_chat: null, p_card: card });
    expect([a.ok, a.msg.body, a.msg.card.item.kind]).toEqual([true, "Вино: Шабли 2022", "wine"]);
    expect(mk(true).rpc("chat_card_send", { p_token: "t1", p_chat: null, p_card: card }).error).toBe("bad_request");
    const s = mk(false); expect(s.rpc("chat_card_send", { p_token: "t1", p_chat: s.S.chats.find((c) => c.kind === "net").id, p_card: card }).error).toBe("bad_request");
  });
  it("этап 46: две функции этапа 38 и _sa_chat_bar_kinds — вид «вино» и «крепкое» там же, где коктейль; подписи; права; «Сервер»", () => {
    const S = rd("supabase/supabase-stage46-bar-share.sql");
    for (const s of ["Этап 46 (v130, Доп. 443)", "Supabase → SQL Editor → New query → вставить файл целиком → Run.", "Можно запускать повторно.",
      "create or replace function _sa_chat_bar_kinds(p_kinds text[])", "then array['wine', 'spirit'] else '{}'::text[] end", "p->>'kind' = any(_sa_chat_bar_kinds(p_kinds))",
      "revoke all on function _sa_chat_bar_kinds(text[]) from public, anon, authenticated;",
      "when 'wine' then 'Вино' when 'spirit' then 'Крепкое'", "revoke all on function _sa_chat_item(jsonb, text[]) from public, anon, authenticated;",
      "revoke all on function _sa_chat_card_sum(jsonb) from public, anon, authenticated;", "raise exception 'Сначала этап 38", "notify pgrst, 'reload schema';"]) expect(S, s).toContain(s);
    expect((S.match(/create or replace function /g) || []).length).toBe(3);
    expect(STAGES.find((x) => x.n === "46")).toEqual({ n: "46", file: "supabase-stage46-bar-share.sql", what: "Вина и крепкое в чат", fn: "_sa_chat_bar_kinds" });   // экран «Сервер»
    expect(S).not.toMatch(/drop |delete |alter table/i);
    expect(rd("tools/claude/pg-check-stage46.mjs")).toContain("supabase-stage46-bar-share.sql");
  });
});

describe("v130: Наставник знает «Барную карту»", () => {
  // владелец: «Ассистент знает о сортимент барной карты? Его нужно учить?» — «Да, делаем так»: учить не нужно, Наставник читает
  // карту в момент вопроса, как меню (lib/reference-context.js), и показывает карточку бутылки
  const R0 = "Два моря, Океан";
  const withStore = async (records, fn) => {
    const was = globalThis.localStorage, store = { sa_menu_shared: JSON.stringify({ [R0]: records }) };
    globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    try { return await fn(await import("../lib/reference-context.js")); } finally { globalThis.localStorage = was; }
  };
  const menu = async () => JSON.parse(JSON.stringify((await import("../data/menu.js")).RESTAURANT_MENUS[R0]));
  it("«Что за шабли у нас?» — вино из карты: откуда, цена, бокалом, ноты, гостю, к блюдам; стоп, «не проверено», архив", async () => {
    const M = await menu(), tem = M.find((d) => d.name && d.name.startsWith("Креветка темпура"));
    const PRO = W.normWine({ name: "Просекко DOC", country: "Италия", region: "Венето", grapes: ["глера"], color: "sparkling", sweet: "брют", byGlass: true, priceGlass: 650, priceBottle: 3600, pair: [tem.id] }, { id: "w-pro" });
    const PIN = W.normWine({ name: "Пино Нуар", country: "Франция", region: "Бургундия", grapes: ["пино нуар"], color: "red", sweet: "сухое", byGlass: true, priceGlass: 1100, stop: { since: 1 } }, { id: "w-pin" });
    await withStore([...M, { ...CHA, pair: [], stop: null }, ROS, OLD, PRO, PIN, CAM], async (RC) => {
      const c = RC.drinkAssistantContext("Что за шабли у нас?", R0);
      expect(c.split("\n")[0]).toBe("— В «Барной карте» (Справочник → «Барная карта»): 4 вина, крепкого 1 позиция.");
      expect(c.split("\n")[1]).toBe("— Вино «Шабли 2022» (Chablis), Domaine Laroche [id: w-cha]. Франция, Бургундия · шардоне · белое сухое · 12,5%. Цена: бокал 950 ₽ · бутылка 5 200 ₽. Есть бокалом. Ноты: зелёное яблоко, мел. Подача: 8–10 °C · бокал «бургундия» · 0,75 л. Гостю: «Свежее и минеральное.».");
      expect(c).not.toMatch(/Старое|\u00a0/);
      expect(RC.drinkAssistantContext("есть ли пино нуар", R0)).toContain("— Вино «Пино Нуар» [id: w-pin]. ВНИМАНИЕ: СЕГОДНЯ НЕТ (стоп-лист), предложи другое из данных.");
      expect(RC.drinkAssistantContext("что за розе", R0)).toContain("Цена: бутылка 5 900 ₽. Есть бокалом. Ноты: клубника. Гостю: «Бледное.». Не проверено руководителем: сорт, ноты.");
      // к блюду: вино, отмеченное к «Креветке темпура», — первым; бокалом — списком без стопа
      const p = RC.drinkAssistantContext("Какое вино налить к креветке темпура?", R0);
      expect(p.split("\n")[1]).toMatch(/^— Вино «Просекко DOC» \[id: w-pro\].+К блюдам: Креветка темпура/);
      expect(RC.drinkAssistantContext("Какие вина есть бокалом?", R0).split("\n")[0]).toBe("— В «Барной карте» (Справочник → «Барная карта»): 4 вина, крепкого 1 позиция. Бокалом: Шабли 2022 950 ₽, Розе, Просекко DOC 650 ₽.");
      expect(RC.drinkAssistantContext("Как решать споры при гостях?", R0)).toBe(null);
      // в сообщении: карта первой (сервер режет до 2000 знаков), кнопка «Открыть барную карту», маркеры вина и крепкого
      const m = RC.withRefContext([{ role: "user", content: "Какое вино налить к креветке темпура?" }], { position: "waiter", restaurant: R0 }, null).pop().content;
      expect(m.length).toBeLessThanOrEqual(2000);
      expect(m.indexOf("— В «Барной карте»")).toBeLessThan(m.indexOf("— Блюдо «Креветка темпура»"));
      for (const x of ["[[go:wines|Открыть барную карту]]", "[[wine:ID]] или [[spirit:ID]]", "других вин и марок не придумывай"]) expect(m, x).toContain(x);
      expect(m).not.toMatch(/Коктейль «/);   // про коктейль не спрашивали — коктейли место не занимают
      // «у нас» больше не тянет «Секс на пляже»
      expect(RC.withRefContext([{ role: "user", content: "Что за шабли у нас?" }], { position: "waiter", restaurant: R0 }, null).pop().content).not.toMatch(/Секс на пляже/);
      // без вин в вопросе — подсказка про маркеры прежняя
      const n = RC.withRefContext([{ role: "user", content: "Расскажи про Негрони" }], { position: "waiter", restaurant: R0 }, null).pop().content;
      expect(n).toContain("ровно [[cocktail:ID]] или [[dish:ID]], без подписи");
      expect(n).not.toMatch(/go:wines/);
    });
    await withStore(await menu(), async (RC) => { expect(RC.drinkAssistantContext("какое вино посоветуешь", R0)).toBe(null); });
  });
  it("карточка под ответом: метка [[wine:ID]] или название; в чате команды — карточка «Вино»; касание — «Барная карта»", async () => {
    const { pickCards } = await import("../lib/ai-cards.js");
    const drinks = [CHA, ROS, CAM];
    const a = pickCards({ text: "Это Шабли 2022.\n[[wine:w-cha]]", question: "что за вино", drinks });
    expect([a.picks.map((x) => x.kind + ":" + x.item.id), a.text]).toEqual([["wine:w-cha"], "Это Шабли 2022.\n"]);
    expect(pickCards({ text: "Горький апельсин.", question: "что за campari", drinks }).picks.map((x) => x.kind + ":" + x.item.id)).toEqual(["spirit:sp-cam"]);
    expect(pickCards({ text: "Минеральное.", question: "расскажи про шабли", drinks }).picks.map((x) => x.item.id)).toEqual(["w-cha"]);   // «Шабли / Chablis» — по русской части
    expect(pickCards({ text: "[[spirit:nope]] [[wine:w-old]]", question: "", drinks: [...drinks, OLD] }).picks).toEqual([]);
    const { aiReply } = await import("../lib/chat-app.js");
    const r = aiReply("Шабли 2022 к устрицам.\n[[wine:w-cha]]", { drinks, question: "что налить к устрицам" });
    expect(r.cards.map((x) => [x.kind, x.id, x.title])).toEqual([["wine", "w-cha", "Шабли 2022"]]);
    const A = rd("ui/assistant.jsx");
    for (const x of ['data-ai-card={card.kind + ":" + w.id}', "Открыть в Барной карте ›", 'wines: "Открыть барную карту"', "onNavigate({ [card.kind]: w.id })"]) expect(A, x).toContain(x);
    const P = rd("App.jsx");
    expect(P).toContain('if (dest && typeof dest === "object" && (dest.wine || dest.spirit)) {');
    expect(P).toContain('barlab: "barLab", wines: "wines",');
    expect(rd("lib/chat-ai.js")).toContain("drinks: barDrinksOf(rest)");
  });
});

describe("v130: гид, документы, метка", () => {
  it("гид: «Барная карта: печать и в чат»; README, CHANGES; без тире-ритма и эмодзи в новом коде; метка — v130", () => {
    const G = rd("ui/guide.jsx");
    expect(G).toContain('{ key: "barprint", title: "Барная карта: печать и в чат"');
    expect(G).toContain('go: "wines" },   // v130');
    expect(rd("tools/claude/README.md")).toContain("`e2e-v130.mjs` — v130 (Доп. 443)");
    expect(rd("tools/claude/README.md")).toContain("pg-check-stage46.mjs");
    expect(rd("CHANGES.md")).toContain("# Дополнение 443 — «Барная карта»: печать, как у меню, и «Поделиться в чат» (v130)");
    for (const f of ["ui/bar-print.jsx", "lib/bar-print.js", "ui/bar-kit.jsx", "ui/bar-card.jsx", "ui/wine-list.jsx", "lib/share-items.js", "ui/chat-kit.jsx"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    for (const x of ["m39-bar-print", "m40-bar-print-page", "m41-share-wine", "data-bar-print-open", "data-share-chat^='wine:'"]) expect(rd("tools/claude/demo-app/check.mjs"), x).toContain(x);
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(13\d|1[4-9]\d|[2-9]\d\d)<\/span>/);
  });
});
