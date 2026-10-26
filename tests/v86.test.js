// v86 (Доп. 399): удобнее — брифинг «Прочитал(а)» и главное на карточке, рассадка «Счёт» и «Твои столы», QR на весь экран
// и ссылки на отзывы, плеер голосов (скорость, «прослушано»), «медленно» и слоги, настройки сообщений группами и тихие
// часы. Вид — tools/claude/e2e-v86.mjs, сервер — tools/claude/sql/test36.sh.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { briefPreview, readStats, readLine, briefFresh, briefText, buildBrief } from "../lib/briefing.js";
import { NEXT, STATUS, isBusy, soonFree, summary, tableSub, boardMap, stateOf, waiterLoad, myTablesOf, myTablesSub, guestsWord } from "../lib/seating.js";
import { voiceRate, setVoiceRate, nextRate, rateLabel, heardKey, heardSet, isHeard, markHeard } from "../lib/voice-note.js";
import { syllables } from "../lib/pronounce.js";
import { reviewKind, reviewButtons, REVIEW_KINDS } from "../lib/guest-thanks.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; };
const NOW = Date.parse("2026-10-23T07:20:00Z");
const iso = (minAgo) => new Date(NOW - minAgo * 60000).toISOString();

const BRIEF = { v: 1, day: "2026-10-23", dayLabel: "23 октября", author: "Мария Ким",
  blocks: { roster: [{ k: "Д", name: "День", from: 12, to: 20, people: ["Мария Ким", "Анна Смирнова"] }, { k: "В", name: "Вечер", from: 16, to: 24, people: ["Пётр Орлов", "Анна Смирнова"] }],
    stop: ["Борщ с уткой", "Негрони", "Паста"], res: [{ t: "19:30", name: "Иванов", cnt: 4, n: "3" }, { t: "20:00", name: "", cnt: 2, n: "5" }],
    fresh: [{ id: "d2", name: "Тартар из тунца", voice: "chef" }, { id: "d3", name: "Паста с крабом", voice: false }], note: "Банкет на 12 человек в 19:00" },
  on: { roster: true, stop: true, res: true, fresh: true, note: true } };

describe("v86: брифинг", () => {
  it("на карточке — главное: стоп-лист (два и «ещё»), брони, новинки; без них — «Своё», иначе — названия блоков", () => {
    expect(briefPreview(BRIEF)).toBe("Стоп-лист: Борщ с уткой, Негрони и ещё 1 · брони: 2 · новинки: Тартар из тунца и ещё 1");
    expect(briefPreview({ ...BRIEF, on: { ...BRIEF.on, stop: false, res: false } })).toBe("Новинки: Тартар из тунца и ещё 1 · Банкет на 12 человек в 19:00");
    expect(briefPreview({ ...BRIEF, on: { roster: true, note: true } })).toBe("Банкет на 12 человек в 19:00");
    expect(briefPreview({ ...BRIEF, on: { roster: true } })).toBe("Кто сегодня");
    expect(briefPreview(null)).toBe("");
  });
  it("кто прочитал: против тех, кто сегодня в графике, автор не в счёт, тёзки по имени и фамилии", () => {
    const st = readStats(BRIEF, [{ name: "Анна", surname: "Смирнова" }, { name: "Ольга", surname: "Ли" }]);
    expect(st).toEqual({ n: 2, total: 2, crew: 1, missing: ["Пётр Орлов"] });
    expect(readLine(st, 2)).toBe("Прочитали 1 из 2 в графике и ещё 1");
    expect(readLine(readStats(BRIEF, []), 0)).toBe("Прочитали 0 из 2 в графике");
    expect(readLine(readStats({ blocks: {} }, [{ name: "А", surname: "Б" }]), 1)).toBe("Прочитали: 1");
    expect(readStats(BRIEF, [{ name: "Пётр", surname: "Орлов" }, { name: "Анна", surname: "Смирнова" }]).missing).toEqual([]);
  });
  it("новинки: записи шефа и сомелье для «послушать» — только ссылки из облака", () => {
    const now = new Date(2026, 9, 23);
    const d = { id: "d1", name: "Буррата", isNew: true, addedAt: now.getTime() - 864e5, voice: { chef: { url: "https://x/a.m4a", sec: 12, name: "Алексей" }, som: { url: "blob:local" } } };
    expect(briefFresh([d], now)).toEqual([{ id: "d1", name: "Буррата", cat: "", voice: "both", voices: [{ kind: "chef", url: "https://x/a.m4a", sec: 12, name: "Алексей" }] }]);
    expect(briefFresh([{ ...d, voice: {} }], now)[0].voices).toBeUndefined();
  });
  it("текст для Telegram: «Отправил(а): …» вместо «от Мария Ким»", () => {
    const t = briefText(buildBrief({ author: "Мария Ким", note: "Банкет", now: new Date(2026, 9, 23) }));
    expect(t.startsWith("Брифинг смены · 23 октября\nОтправил(а): Мария Ким")).toBe(true);
    expect(t).not.toMatch(/\nот /);
  });
  it("чтение: «Отправил(а): …»; карточка руководителю — «Прочитали 1 из 2 в графике»", async () => {
    const { BriefView, BriefCard } = await import("../ui/briefing.jsx");
    const v = R(h(BriefView, { a11y: false, brief: { data: BRIEF, author: "Мария Ким", mine: false }, onClose: () => {} }));
    expect(v).toContain("Отправил(а): Мария Ким");
    expect(v).not.toContain("От Мария");
    expect(v).toContain(">Понятно</button>");   // до ответа brief_reads — «Понятно»; «Прочитал(а)» — когда сервер знает этап 36
    const card = R(h(BriefCard, { a11y: true, brief: { data: BRIEF, author: "Мария Ким" }, seen: false, reads: { n: 1, rows: [{ name: "Анна", surname: "Смирнова" }] }, onOpen: () => {} }));
    expect(card).toContain("Стоп-лист: Борщ с уткой, Негрони и ещё 1 · брони: 2 · новинки: Тартар из тунца и ещё 1");
    expect(card).toContain("Прочитали 1 из 2 в графике");
    expect(card).toContain('aria-label="Брифинг смены, отправил(а) Мария Ким: открыть"');
    const staffCard = R(h(BriefCard, { a11y: false, brief: { data: BRIEF, author: "Мария Ким" }, seen: true, onOpen: () => {} }));
    expect(staffCard).not.toContain("Прочитали");
  });
});

describe("v86: рассадка — «Счёт» и «Твои столы»", () => {
  const PLAN = { v: 1, tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }, { id: "t2", n: "2", seats: 4, shape: "rd", x: 2, y: 0 }, { id: "t5", n: "5", seats: 6, shape: "long", x: 2, y: 2 }, { id: "t3", n: "3", seats: 2, shape: "sq", x: 4, y: 0 }] };
  const ROWS = [
    { tid: "t1", status: "seat", cnt: 3, since: iso(40), waiter_id: "e-anna", waiter_name: "Анна Смирнова" },
    { tid: "t2", status: "bill", cnt: 4, since: iso(95), waiter_id: "e-petr", waiter_name: "Пётр Орлов" },
    { tid: "t5", status: "bill", cnt: 2, since: iso(70), waiter_id: "e-anna", waiter_name: "Анна Смирнова" },
  ];
  it("следующее действие: гости → счёт → уборка → свободен; «Счёт» — тоже занятый стол", () => {
    expect(NEXT).toEqual({ free: "seat", res: "seat", seat: "bill", bill: "clean", clean: "free" });
    expect(STATUS.bill).toBe("Счёт");
    expect([isBusy({ status: "seat" }), isBusy({ status: "bill" }), isBusy({ status: "res" }), isBusy(null)]).toEqual([true, true, false, false]);
  });
  it("сводка: гости и со «Счётом»; на столе — «счёт»; скоро освободятся — со «Счётом», где хватает мест, дольше сидят — первыми", () => {
    expect(summary(PLAN, ROWS)).toEqual({ total: 4, free: 1, seat: 1, bill: 2, guests: 9, res: 0, clean: 0 });
    expect(tableSub(PLAN.tables[1], stateOf(boardMap(ROWS), "t2"), NOW)).toBe("счёт");
    expect(soonFree(PLAN, ROWS, 4)).toEqual(["t2", "t5"]);
    expect(soonFree(PLAN, ROWS, 6)).toEqual(["t5"]);
    expect(soonFree(PLAN, ROWS, 8)).toEqual([]);
  });
  it("официанты: столы со «Счётом» — тоже их столы", () => {
    expect(waiterLoad(PLAN, ROWS, [], {}).busy).toEqual([{ id: "e-anna", name: "Анна С.", tables: ["1", "5"], guests: 5 }, { id: "e-petr", name: "Пётр О.", tables: ["2"], guests: 4 }]);
  });
  it("«Твои столы» в «Смене»: по доске seat_board и своему id", () => {
    const board = { ok: true, plan: PLAN, tables: ROWS };
    expect(myTablesOf(board, "e-anna")).toEqual({ n: ["1", "5"], guests: 5, bill: 1 });
    expect(myTablesSub(myTablesOf(board, "e-anna"))).toBe("Твои столы: 1, 5 · 5 гостей · счёт: 1");
    expect(myTablesSub(myTablesOf(board, "e-petr"))).toBe("Твой стол: 2 · 4 гостя · счёт: 1");
    expect(myTablesSub(myTablesOf(board, "e-ilya"))).toBe("");
    expect(myTablesOf({ ok: true, plan: null }, "e-anna")).toBe(null);
    expect([guestsWord(1), guestsWord(3), guestsWord(11), guestsWord(21)]).toEqual(["1 гость", "3 гостя", "11 гостей", "21 гость"]);
  });
  it("карточка стола: пять статусов по порядку; у стола с гостями сразу «Счёт», у стола со «Счётом» — «Уборка»", async () => {
    const { TableSheet, Floor } = await import("../ui/seating.jsx");
    const map = boardMap(ROWS);
    const s1 = R(h(TableSheet, { a11y: false, t: PLAN.tables[0], row: stateOf(map, "t1"), staff: [], now: NOW, onSave: async () => true, onClose: () => {} }));
    expect([...s1.matchAll(/data-sheet-status="([a-z]+)"/g)].map((m) => m[1])).toEqual(["seat", "bill", "clean", "free", "res"]);
    expect(s1).toContain('aria-checked="true" data-sheet-status="bill"');
    expect(s1).toContain(">Попросили счёт</button>");
    const s2 = R(h(TableSheet, { a11y: true, t: PLAN.tables[1], row: stateOf(map, "t2"), staff: [], now: NOW, onSave: async () => true, onClose: () => {} }));
    expect(s2).toContain('aria-checked="true" data-sheet-status="clean"');
    expect(s2).toContain("сейчас: счёт, 4 гостя, 1 ч 35 мин");
    const fl = R(h(Floor, { a11y: false, plan: PLAN, map, now: NOW }));
    expect(fl).toContain('data-table="t2" data-status="bill"');
    expect(fl).toContain('aria-label="Стол 2, 4 места: счёт, гостей 4"');
  });
  it("экран: «Счёт» в сводке, легенде и подборе; без этапа 36 — понятная ошибка", () => {
    const src = rd("ui/seating.jsx");
    expect(src).toContain('{sum.bill ? <><span>·</span><span>Счёт <b style={{ color: c.text }}>{sum.bill}</b></span></> : null}');
    expect(src).toContain('{["free", "res", "seat", "bill", "clean"].map((k) =>');
    expect(src).toContain("Скоро освободится: {soon.map(tn).join(\", \")} (попросили счёт).");
    expect(src).toContain('ok === "need36" ? "Статус «Счёт» появится, когда на сервер добавят этап 36."');
  });
});

describe("v86: голоса и произношение", () => {
  it("скорость 1× / 1,5× — помнит телефон; чужое значение — 1", () => {
    const m = mem();
    expect(voiceRate(m)).toBe(1);
    setVoiceRate(1.5, m);
    expect([voiceRate(m), m._m.sa_voice_rate]).toEqual([1.5, "1.5"]);
    setVoiceRate(3, m);
    expect(voiceRate(m)).toBe(1);
    expect([nextRate(1), nextRate(1.5), rateLabel(1), rateLabel(1.5)]).toEqual([1.5, 1, "1×", "1,5×"]);
  });
  it("«прослушано» — по ссылке записи (перезаписали — снова новая), до 400 записей", () => {
    const m = mem();
    const v = { url: "https://abc.supabase.co/storage/v1/object/public/menu-voice/r/d1-chef.m4a?t=1" };
    expect(heardKey(v)).toBe("/storage/v1/object/public/menu-voice/r/d1-chef.m4a");
    expect(isHeard(v, heardSet(m))).toBe(false);
    markHeard(v, m);
    expect(isHeard(v, heardSet(m))).toBe(true);
    expect(isHeard({ url: "https://abc.supabase.co/storage/v1/object/public/menu-voice/r/d1-chef-2.m4a" }, heardSet(m))).toBe(false);
    for (let i = 0; i < 420; i++) markHeard({ url: "https://x/v" + i + ".m4a" }, m);
    expect(Object.keys(heardSet(m)).length).toBe(400);
    expect(heardKey(null)).toBe("");
  });
  it("по слогам: ударный слог заглавными, двойные согласные пополам, привычные пары — к следующему слогу", () => {
    expect(syllables("Бурр+ата")).toBe("бур-РА-та");
    expect(syllables("Шардон+е")).toBe("шар-до-НЕ");
    expect(syllables("Совинь+он блан")).toBe("со-ви-НЬОН блан");
    expect(syllables("Р+ислинг")).toBe("РИС-линг");
    expect(syllables("Прос+екко")).toBe("про-СЕК-ко");
    expect(syllables("Эспр+ессо")).toBe("эс-ПРЕС-со");
    expect(syllables("Шамп+анское")).toBe("шам-ПАН-ско-е");
    expect(syllables("Гевюрцтрамин+ер")).toBe("ге-вюрц-тра-ми-НЕР");
    expect(syllables("Монтепульч+ано д’Абр+уццо")).toBe("мон-те-пуль-ЧА-но д’а-БРУЦ-цо");
    expect(syllables("Тарт+ар с +юдзу")).toBe("тар-ТАР с Ю-дзу");
    expect([syllables("блан"), syllables("Chardonnay"), syllables("")]).toEqual(["", "", ""]);
  });
  it("плеер «Голосов» и «медленно» в словаре", () => {
    const vn = rd("ui/voice-note.jsx"), pr = rd("ui/pronounce.jsx");
    expect(vn).toContain("if (rate && rate !== 1) { try { audio.defaultPlaybackRate = rate; audio.playbackRate = rate; } catch (e) {} }");
    expect(vn).toContain('data-voices-player={st}');
    // экранному диктору — строка на запись, а не весь плеер со временем (оно меняется четыре раза в секунду)
    expect(vn).toContain('<span data-voices-now="" aria-live="polite"');
    expect(vn).not.toMatch(/data-voices-player=\{st\} aria-live/);
    expect(vn).toContain('{"Звучит: " + now.d.name + ". "');
    expect(vn).toContain("Только новые · {fresh.length}");
    expect(pr).toContain('<SayButton w={e.w} slow gold={gold} sub={sub} a11y={a11y} label="медленно" />');
    expect(pr).toContain("u.lang = lang || \"ru-RU\"; u.rate = slow ? 0.55 : 0.85;");
    expect(pr).toContain("rate: slow ? 0.7 : 1,");
  });
});

describe("v86: спасибо от гостей — QR на весь экран и отзывы", () => {
  it("ссылки на отзывы: только https и только страницы карт (как на сервере)", () => {
    expect(reviewKind("https://yandex.ru/maps/org/dva_morya/123/reviews/")).toBe("yandex");
    expect(reviewKind("https://2gis.ru/petropavlovsk/firm/7000")).toBe("2gis");
    expect(reviewKind("https://maps.app.goo.gl/AbCd")).toBe("google");
    expect(reviewKind("https://search.google.com/local/writereview?placeid=x")).toBe("google");
    expect([reviewKind("http://yandex.ru/maps/org/1"), reviewKind("https://evil.example/?yandex.ru/maps"), reviewKind("https://yandex.ru/maps/a b"), reviewKind("https://google.com/search?q=maps")]).toEqual(["", "", "", ""]);
    expect(reviewButtons([{ url: "https://yandex.ru/maps/org/1" }, { url: "https://evil.example/" }, { url: "https://yandex.ru/maps/org/2" }, { url: "https://2gis.ru/x/firm/1" }]))
      .toEqual([{ url: "https://yandex.ru/maps/org/1", kind: "yandex", label: REVIEW_KINDS.yandex }, { url: "https://2gis.ru/x/firm/1", kind: "2gis", label: "Отзыв в 2ГИС" }]);
    expect(reviewButtons(null)).toEqual([]);
  });
  it("QR на весь экран: светлый фон, имя, «Наведите камеру…», крестик для «Назад»", async () => {
    const { QrFull } = await import("../ui/thanks.jsx");
    const html = R(h(QrFull, { url: "https://app.example/?thanks=a1b2c3d4e5", name: "Анна", pos: "Официант", restaurant: "Два моря", onClose: () => {} }));
    expect(html).toContain("data-thanks-full");
    expect(html).toContain("background:#F7F0E1");
    expect(html).toContain("Скажите спасибо");
    expect(html).toContain("Наведите камеру телефона на код");
    expect(html).toContain('data-sa-back=""');
    const src = rd("ui/thanks.jsx");
    expect(src).toContain('navigator.wakeLock.request("screen")');
    expect(src).toContain("Показать гостю на весь экран");
  });
  it("страница гостя: ссылки — после «Спасибо передано», в новой вкладке и без передачи адреса", () => {
    const src = rd("ui/guest-thanks.jsx");
    expect(src).toContain('if (!code || (done !== "ok" && done !== "dup")) return undefined;');
    expect(src).toContain('rpc("guest_review_links", { p_code: code })');
    expect(src).toContain('target="_blank" rel="noopener noreferrer"');
  });
});

describe("v86: «Напоминания в Telegram» — группы и тихие часы", () => {
  it("строки группами «Учёба / Смена / Команда», в порядке группы; каждая строка в какой-то группе", async () => {
    const { prefGroups, prefRows, PREF_GROUPS, QUIET, quietLabel } = await import("../ui/day-cards");
    const all = { ok: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true, qday: true, brief: true, cases: true, thanks: true, seat: true };
    expect(prefGroups(all).map(([id, t, rows]) => id + ":" + rows.map((r) => r[0]).join(","))).toEqual(["study:pair,qday,fresh,month", "shift:quest,brief,seat,cases", "team:league,master,thanks"]);
    expect(prefGroups(all).map((g) => g[1])).toEqual(["Учёба", "Смена", "Команда"]);
    const grouped = PREF_GROUPS.flatMap((g) => g[2]).sort();
    expect(prefRows({ ...all, chat: true }).map((r) => r[0]).sort()).toEqual(grouped);   // v90: и «Чат смены» (этап 38)
    expect(prefGroups({ ok: true }).map(([id, , rows]) => id + ":" + rows.length)).toEqual(["study:3", "shift:1", "team:1"]);   // этап 25: пять видов
    expect(QUIET.map((q) => q[2])).toEqual(["Нет", "22:00–8:00", "23:00–9:00", "0:00–10:00", "2:00–12:00"]);
    expect([quietLabel(null, null), quietLabel(21, 7)]).toEqual(["Нет", "21:00–7:00"]);
  });
  it("тихие часы — кнопками, не переключателями (счёт переключателей в старых проверках прежний)", () => {
    const src = rd("ui/day-cards.jsx");
    expect(src).toContain('<button key={l} type="button" aria-pressed={on} data-quiet={l}');
    expect(src).toContain('rpc("notify_quiet", { p_token: saToken() })');
    expect(src).toContain('rpc("notify_quiet_set", { p_token: saToken(), p_from: f, p_to: t })');
  });
});

describe("v86: в приложении и справке", () => {
  const app = rd("App.jsx");
  it("«Твои столы» — из seat_board при входе в «Смену» и раз в минуту; руководителю на карточке — прочитавшие", () => {
    expect(app).toContain('import { myTablesOf, myTablesSub } from "./lib/seating";');
    expect(app).toContain("if (r && r.ok) setMyTables(myTablesOf(r, profile.id));");
    expect(app).toContain("const t = setInterval(ask, 60e3);");
    expect(app).toContain('sub: myTablesSub(myTables) || "Схема зала: кто где сидит, брони и уборка"');
    expect(app).toContain('if (b && lead) rpc("brief_reads", { p_token: saToken() })');
    expect(app).toContain("reads={isLead ? briefReads : null}");
  });
  it("справка: брифинг, рассадка, спасибо, напоминания, голоса и «Как произносить»", async () => {
    const { GUIDE } = await import("../ui/guide.jsx");
    const all = GUIDE.flatMap((g) => g.items || []);
    const t = (k) => (all.find((x) => x.key === k) || {}).text || "";
    expect(t("brief")).toContain("Внизу чтения «Прочитал(а)»");
    expect(t("seat")).toContain("столу с гостями «Счёт», после счёта «Уборка»");
    expect(t("thanks")).toContain("«Показать гостю на весь экран»");
    expect(t("thanks")).toContain("«Отзывы о заведении»");
    expect(t("remind")).toContain("«Тихие часы»: в это время бот молчит, кроме напоминания о смене.");
    expect(t("menuvoice")).toContain("скоростью 1× или 1,5×");
    expect(t("menuvoice")).toContain("слово по слогам");
  });
  it("тексты — без тире между словами и без восклицаний", () => {
    for (const f of ["ui/seating.jsx", "lib/seating.js", "ui/voice-note.jsx", "ui/pronounce.jsx", "lib/pronounce.js", "ui/thanks.jsx", "ui/guest-thanks.jsx", "lib/guest-thanks.js", "ui/briefing.jsx", "lib/briefing.js"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
    }
  });
});

describe("v86: этап 36 на сервере", () => {
  const sql = rd("supabase/supabase-stage36-comfort.sql");
  it("брифинг: отметка позже последней правки, автор не в счёт, список — только руководителю", () => {
    expect(sql).toContain("r.read_at >= b.updated_at");
    expect(sql).toContain("and r.emp_id is distinct from b.author_id");
    expect(sql).toContain("if coalesce((c->>'lead')::boolean, false) then");
  });
  it("рассадка: «Счёт» хранит гостей, официанта и время посадки, без сообщения", () => {
    expect(sql).toContain("if st not in ('free', 'res', 'seat', 'bill', 'clean')");
    expect(sql).toContain("case when busy then case when coalesce(old.status, '') in ('seat', 'bill') then old.since else now() end end,");
    expect(sql).toContain("if st = 'seat' and wid is not null and wid <> c->>'id' and (coalesce(old.status, '') not in ('seat', 'bill') or old.waiter_id is distinct from wid)");
  });
  it("отзывы: только карты по https, до двух; гостю — по коду QR", () => {
    expect(sql).toContain("when p_url ~* '^https://(www\\.)?(yandex\\.(ru|com|kz|by|uz)|ya\\.ru)/(maps|profile)(/|\\?|$)' then 'yandex'");
    expect(sql).toContain("jsonb_array_length(p_links) > 2");
    expect(sql).toContain("r := _sa_thanks_emp(p_code);");
  });
  it("тихие часы: в _sa_tg_chat, только для видов сообщений; через полночь", () => {
    expect(sql).toContain("if pref is not null and p_kind is not null and pref->>'quiet_from' is not null and pref->>'quiet_to' is not null then");
    expect(sql).toContain("case when p_from < p_to then p_hour >= p_from and p_hour < p_to else p_hour >= p_from or p_hour < p_to end");
    expect(sql).toContain("alter table sa_notify_prefs add column if not exists quiet_from smallint;");
    expect(sql).toContain("revoke all on table sa_brief_reads from public, anon, authenticated;");
    expect(sql).toContain("revoke all on table sa_review_links from public, anon, authenticated;");
  });
});

describe("v86: метка и журнал", () => {
  it("«сборка v86», «Дополнение 399»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(8[6-9]|9\d|\d{3,})<\/span>/);   // v86 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 399 — удобнее: брифинг «Прочитал(а)», «Счёт» в рассадке, отзывы гостей, плеер голосов, тихие часы (v86)");
  });
});
