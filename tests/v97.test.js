// v97 (Доп. 410): чат как часть приложения. «Поделиться в чат» (Колода меню, Колода бармена, Справочник, урок),
// «Смены в чате команды» в «Графике» (забрать и выйти отсюда, отдать и поменяться в чате), «Спросить в чате команды»
// у руководителя, «График готов» и «Пожелания» карточкой, стоп из Меню и брифинг — в чат; карточка коллеги по имени;
// ссылки из Telegram в чат к сообщению, на урок и в график. Сервер — этап 38 (chat_shift_need, chat_shift_board,
// chat_person, chat_stop_note, chat_card_send с «Вся команда»). Вид — tools/claude/e2e-v97.mjs, демо — tools/claude/demo-app.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const rd = (f) => readFileSync(f, "utf8");
const DASH = /[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const strs = (s) => (code(s).match(/"[^"\n]*"|`[^`\n]*`/g) || []).join("\n");

describe("v97: что уходит в чат по «Поделиться в чат» (lib/share-items.js)", () => {
  it("блюдо: раздел и названия без состава в скобках, не длиннее 110 знаков; фото — только https", async () => {
    const S = await import("../lib/share-items.js");
    const d = { id: "ok2601", name: "Ассорти паштетов", cat: "Закуски", img: "/menu/okean_01.jpg",
      ingredients: ["Паштет из осьминога (осьминог, лук, сливки)", "Рыбный паштет (красная рыба, сливки)", "Крабовый паштет (краб, лук)", "Гречневые чипсы"] };
    const it1 = S.dishShareItem(d);
    expect(it1).toEqual({ kind: "dish", id: "ok2601", title: "Ассорти паштетов", sub: "Закуски · Паштет из осьминога, Рыбный паштет, Крабовый паштет", img: "" });
    expect(S.dishShareItem({ ...d, img: "https://x.supabase.co/storage/v1/object/public/menu/a.jpg" }).img).toMatch(/^https:\/\//);
    expect(S.dishShareItem({ ...d, img: "data:image/jpeg;base64,AAAA" }).img).toBe("");
    const long = S.dishShareItem({ id: 1, name: "X", cat: "Горячее", ingredients: Array.from({ length: 3 }, (_, i) => "Очень длинное название ингредиента номер " + i) });
    expect(long.sub.length).toBeLessThanOrEqual(110);
    expect(long.sub.endsWith("…")).toBe(true);
    expect(long.id).toBe("1");
  });
  it("коктейль, глава Справочника, урок и тест: вид, id, подпись, минуты", async () => {
    const S = await import("../lib/share-items.js");
    expect(S.cocktailShareItem({ id: "negroni", name: "Негрони", ing: [["Джин", "30 мл"], ["Кампари", "30 мл"], ["Вермут (красный)", "30 мл"], ["Апельсин", ""]] }))
      .toEqual({ kind: "cocktail", id: "negroni", title: "Негрони", sub: "Джин, Кампари, Вермут" });
    expect(S.refShareItem({ id: "srv-basics", title: "Основы сервировки" }, "Сервировка")).toEqual({ kind: "ref", id: "srv-basics", title: "Основы сервировки", sub: "Сервировка" });
    expect(S.lessonShareItem({ id: "s1-3", title: "Урок", type: "lesson", minutes: 7 }, { title: "Мышление сервиса" })).toEqual({ kind: "lesson", id: "s1-3", title: "Урок", sub: "Мышление сервиса", mins: 7 });
    expect(S.lessonShareItem({ id: "s1-q", title: "Тест", type: "quiz" })).toEqual({ kind: "quiz", id: "s1-q", title: "Тест", sub: "" });
  });
  it("id подходят серверу (_sa_chat_item: ^[A-Za-z0-9_.:-]{1,80}$), в том числе свой коктейль «house:…»", async () => {
    const S = await import("../lib/share-items.js");
    const re = /^[A-Za-z0-9_.:-]{1,80}$/;
    expect(re.test(S.cocktailShareItem({ id: "house:ok31", name: "Свой", ing: [] }).id)).toBe(true);
    expect(re.test(S.dishShareItem({ id: "i1730000000000_2", name: "Новое" }).id)).toBe(true);
  });
});

describe("v97: «Смены в чате команды» в «Графике» (lib/schedule-chat.js)", () => {
  const MK = "2026-10";
  const card = (o) => ({ t: "shift", st: "open", k: "В", posKey: "waiter", fromName: "Вера Соколова", ...o });
  const offers = [
    { msg: 12, chat: 1, mine: false, card: card({ mode: "give", date: "2026-10-29", sid: "5", can: true }) },
    { msg: 11, chat: 1, mine: false, card: card({ mode: "need", date: "2026-10-29", n: 2, took: [{ id: "e-petr" }], fromName: "Мария Ким", can: true }) },
    { msg: 13, chat: 1, mine: false, card: card({ mode: "swap", date: "2026-10-30", fromName: "Пётр Орлов", can: false }) },
    { msg: 14, chat: 1, mine: true, card: card({ mode: "give", date: "2026-10-28", fromName: "Анна Смирнова" }) },
    { msg: 15, chat: 1, mine: true, card: card({ mode: "need", date: "2026-10-31", fromName: "Анна Смирнова" }) },
    { msg: 16, chat: 1, mine: false, card: card({ mode: "give", date: "2026-11-02", can: true }) },
    { msg: 17, chat: 1, mine: false, card: card({ mode: "give", date: "2026-10-27", st: "done", can: true }) },
  ];
  it("день ↔ дата месяца", async () => {
    const C = await import("../lib/schedule-chat.js");
    expect(C.isoDay(MK, 7)).toBe("2026-10-07");
    expect(C.dayOfIso(MK, "2026-10-29")).toBe(29);
    expect(C.dayOfIso(MK, "2026-11-02")).toBe(0);
    expect(C.dayOfIso(MK, "bad")).toBe(0);
  });
  it("строки сотрудника: свои (без «Ищем»), что можно взять (сервер сказал can), этого месяца, открытые, по дням", async () => {
    const C = await import("../lib/schedule-chat.js");
    const { mine, take } = C.boardRows(offers, MK);
    expect(mine.map((r) => r.msg)).toEqual([14]);
    expect(take.map((r) => r.msg)).toEqual([11, 12]);              // 29: сначала ранний msg; swap без can — не здесь
    expect(take[0]).toMatchObject({ mode: "need", day: 29, n: 2, took: 1, left: 1 });
    expect(take[1]).toMatchObject({ mode: "give", who: "Вера С.", sid: "5" });
    expect(C.boardRows(null, MK)).toEqual({ mine: [], take: [] });
    expect(C.boardRows(offers, "2026-11").take.map((r) => r.msg)).toEqual([16]);
  });
  it("руководителю — открытые «Ищем» (свои и чужие); слова строк", async () => {
    const C = await import("../lib/schedule-chat.js");
    expect(C.boardNeeds(offers, MK).map((r) => r.msg)).toEqual([11, 15]);
    const r = C.boardRows(offers, MK).take;
    expect(C.boardWho(r[0])).toBe("Ищем официанта");                 // нужно ещё одного
    expect(C.boardWho({ mode: "need", pos: "waiter", n: 2, left: 2 })).toBe("Ищем 2 официантов");
    expect(C.boardWho({ mode: "need", pos: "waiter", n: 1, left: 1, instead: "Дарья Л." })).toBe("Ищем замену");
    expect(C.boardWho(r[1])).toBe("Вера С. отдаёт смену");
    expect(C.boardWho({ mode: "swap", who: "Пётр О." })).toBe("Пётр О. хочет поменяться");
    expect(C.mineWho({ mode: "swap" })).toBe("Ты предлагаешь обмен");
    expect(C.mineWho({ mode: "give" })).toBe("Ты отдаёшь смену");
    expect(C.needProgress({ n: 2, took: 1 })).toBe("вышли 1 из 2");
    expect(C.needProgress({ n: 3, took: 0 })).toBe("пока никто из 3");
    expect(C.needProgress({ n: 1, took: 0, instead: "Дарья Л." })).toBe("вместо Дарья Л., пока никто");
    expect(C.boardErr({ error: "taken" })).toBe("Смену уже забрали");
    expect(C.boardErr({ error: "not_allowed", why: "Не получится: в этот день уже есть смена" })).toBe("Не получится: в этот день уже есть смена");
    expect(C.boardErr({ error: "forbidden" })).toBe("Искать в чате может руководитель");
  });
});

describe("v97: умный чат — «Ищем в смену», «График готов», карточка коллеги (lib/chat-smart.js)", () => {
  it("должность в словах и падежах, месяц словом", async () => {
    const C = await import("../lib/chat-smart.js");
    expect(C.posWord("waiter")).toBe("официант");
    expect(C.posWord("waiter", true)).toBe("официанты");
    expect(C.posAcc("waiter", 1)).toBe("официанта");
    expect(C.posAcc("bar", 3)).toBe("3 барменов");
    expect(C.posAcc("unknown", 2)).toBe("2 человек");
    expect(C.monthWord("2026-11")).toBe("ноябрь");
    expect(C.monthWord("2026-13")).toBe("");
  });
  it("карточка «Ищем»: строка и строка руководителям; «График готов» и «Пожелания до…»", async () => {
    const C = await import("../lib/chat-smart.js");
    const now = new Date(2026, 9, 27, 10);
    const need = { t: "shift", mode: "need", date: "2026-10-30", label: "Вечер", time: "16:00–24:00", posKey: "waiter", n: 2, st: "open", took: [] };
    expect(C.cardSummary(need, now)).toMatch(/^Ищем 2 официантов: /);
    const inst = { ...need, n: 1, instead: { sid: "6", name: "Дарья Лебедева" } };
    expect(C.cardSummary(inst, now)).toMatch(/^Ищем замену: .*\(официант\)$/);
    expect(C.insteadLine(inst)).toBe("вместо Дарья Л.");
    const done = { ...inst, st: "done", took: [{ id: "e-vera", name: "Вера Соколова" }] };
    expect(C.shiftLogLine(done)).toBe("Замена пт 30, вечер (официант): выходит Вера С., не выходит Дарья Л. · график обновлён");
    expect(C.shiftLogLine({ ...need, st: "done", took: [{ id: "e-petr", name: "Пётр Орлов" }] })).toBe("Смена пт 30, вечер (официант): выходит Пётр О. · график обновлён");
    expect(C.cardSummary({ t: "sched", what: "ready", month: "2026-11" }, now)).toBe("График на ноябрь готов");
    expect(C.cardSummary({ t: "sched", what: "wishes", month: "2026-12", until: "2026-11-20" }, now)).toBe("Пожелания на декабрь: до 20 ноября");
    expect(C.schedView({ t: "sched", what: "ready", month: "2026-11" })).toMatchObject({ btn: "Открыть график" });
  });
  it("карточка коллеги: смена сегодня, иначе ближайшая, иначе «смен нет»", async () => {
    const C = await import("../lib/chat-smart.js");
    const now = new Date(2026, 9, 27, 10);
    expect(C.personShiftLine({ today: { label: "Вечер", time: "16:00–24:00" } }, now)).toBe("Сегодня в смене: вечер 16:00–24:00");
    expect(C.personShiftLine({ next: { date: "2026-10-29", label: "День", time: "12:00–20:00" } }, now)).toMatch(/^Ближайшая смена: .*день 12:00–20:00$/);
    expect(C.personShiftLine({}, now)).toBe("В графике на две недели вперёд смен нет");
  });
});

describe("v97: сервер демо и e2e (tools/claude/demo-app/fake-server.js) — как этап 38", () => {
  const mk = async () => {
    const F = await import("../tools/claude/demo-app/fake-server.js");
    const R0 = "Два моря, Океан";
    const people = [{ id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager" }, { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter" },
      { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: R0, position: "waiter" }, { id: "e-darya", name: "Дарья", surname: "Лебедева", restaurant: R0, position: "waiter" }];
    const sstaff = [{ id: 1, name: "Ким Мария", pos: "manager" }, { id: 3, name: "Смирнова Анна", pos: "waiter" }, { id: 5, name: "Соколова Вера", pos: "waiter" }, { id: 6, name: "Лебедева Дарья", pos: "waiter" }];
    return F.makeServer({ today: "2026-10-27", rest: R0, people, tok: { m: "u-maria", a: "e-anna", v: "e-vera", d: "e-darya" }, sstaff, cfg: { shifts: F.SHIFTS, staff: sstaff },
      plan: { 3: { 0: "Д", 1: "Д" }, 5: { 1: "В" }, 6: { 3: "Д" } }, menu: [{ id: "d1", name: "Тартар", cat: "Закуски" }] });
  };
  it("замена: «Ищем замену» → заявки месяца → «Выйду»: график, строка руководителям, карточка закрыта", async () => {
    const s = await mk();
    expect(s.rpc("chat_shift_need", { p_token: "a", p_chat: null, p_date: "2026-10-30", p_pos: "waiter", p_k: "Д", p_instead: "6" }).error).toBe("forbidden");
    const r = s.rpc("chat_shift_need", { p_token: "m", p_chat: null, p_date: "2026-10-30", p_pos: "waiter", p_k: "Д", p_instead: "6" });
    expect(r.ok).toBe(true);
    expect(r.msg.card).toMatchObject({ mode: "need", n: 1, instead: { sid: "6", name: "Дарья Лебедева" }, took: [] });
    expect(s.rpc("chat_shift_need", { p_token: "m", p_chat: null, p_date: "2026-10-30", p_pos: "waiter", p_k: "Д", p_instead: "6" }).error).toBe("already");
    const b = s.rpc("chat_shift_board", { p_token: "a", p_month: "2026-10" });
    expect(b.offers).toHaveLength(1);
    expect(b.offers[0]).toMatchObject({ mine: false, card: { can: true } });
    expect(s.rpc("chat_shift_board", { p_token: "d", p_month: "2026-10" }).offers[0].card.can).toBe(false);   // вместо неё
    const t = s.rpc("chat_shift_take", { p_token: "a", p_msg: r.msg.id });
    expect(t.ok).toBe(true);
    expect(s.code("3", "2026-10-30")).toBe("Д");
    expect(s.code("6", "2026-10-30")).toBe("");
    expect(s.S.msgs.find((m) => m.chat === 2).body).toBe("Замена пт 30, день (официант): выходит Анна С., не выходит Дарья Л. · график обновлён");
    expect(s.rpc("chat_shift_board", { p_token: "a", p_month: "2026-10" }).offers).toHaveLength(0);
  });
  it("стоп из Меню, «График готов», брифинг одной карточкой в день, карточка коллеги", async () => {
    const s = await mk();
    const on = s.rpc("chat_stop_note", { p_token: "m", p_dish: "d1", p_on: true });
    expect(on.msg.body).toBe("В стоп-листе: Тартар");
    expect(s.rpc("chat_stop_note", { p_token: "m", p_dish: "d1", p_on: true }).again).toBe(true);
    expect(s.rpc("chat_stop_note", { p_token: "m", p_dish: "d1", p_on: false })).toMatchObject({ ok: true, n: 1 });
    expect(s.rpc("chat_card_send", { p_token: "m", p_chat: null, p_card: { t: "sched", month: "2026-11" } }).msg.body).toBe("График на ноябрь готов");
    expect(s.rpc("chat_card_send", { p_token: "m", p_chat: null, p_card: { t: "sched", month: "2026-09" } }).error).toBe("bad_request");
    const b1 = s.rpc("chat_card_send", { p_token: "m", p_chat: null, p_card: { t: "brief", title: "Брифинг", lines: ["Кто сегодня: …"] } });
    const b2 = s.rpc("chat_card_send", { p_token: "m", p_chat: null, p_card: { t: "brief", title: "Брифинг", lines: ["Правка"] } });
    expect(b2.again).toBe(true);
    expect(b2.msg.id).toBe(b1.msg.id);
    const p = s.rpc("chat_person", { p_token: "a", p_emp: "e-vera" });
    expect(p.person).toMatchObject({ name: "Вера Соколова", pos: "waiter", me: false, same: true, today: null, next: { date: "2026-10-28", label: "Вечер" } });
    expect(s.rpc("no_such_fn", {}).code).toBe("PGRST202");
  });
});

describe("v97: приложение и чат — связки", () => {
  const app = rd("App.jsx");
  it("App: «Поделиться в чат» есть там, где есть чат, — Меню, Колода бармена, Справочник, урок; брифинг и «График»", () => {
    expect(app).toMatch(/const chatShare = profile && profile\.restaurant && chatOn \? \(item\) => openChatWith\(\{ kind: "share", item \}\) : null;/);
    for (const re of [/<MenuTrainerScreen[\s\S]{0,500}?onShareChat=\{chatShare\}/, /<CocktailsScreen[\s\S]{0,900}onShareChat=\{chatShare\}/, /<ReferenceSection[\s\S]{0,600}onShareChat=\{chatShare\}/,
      /onContents=\{activeModule \? \(\) => navigate\("module"\) : undefined\} onShareChat=\{chatShare\}/, /<ScheduleScreen T=\{T\} a11y=\{a11y\} profile=\{profile\} onBack=\{\(\) => goBack\(\)\} chat=\{schedChat\}/,
      /toChat=\{!!\(chatOn && profile\.restaurant\)\}/]) expect(app).toMatch(re);
    expect(app).toMatch(/setChatClosedAt\(Date\.now\(\)\)/);   // чат закрыли — «График» перечитает
  });
  it("ссылки из Telegram: chat_<чат>_<сообщение>, lesson_<урок>, schedule", () => {
    expect(app).toMatch(/\/\^chat_\\d\{1,12\}\(_\\d\{1,15\}\)\?\$\/\.test\(v\)/);
    expect(app).toMatch(/\/\^lesson_\[A-Za-z0-9_\.:-\]\{1,80\}\$\/\.test\(v\)/);
    expect(app).toMatch(/else if \(g === "schedule"\) navigate\("schedule"\);/);
  });
  it("«График»: заявки из чата (текущий и следующий месяц), «Забрать»/«Выйду», «Спросить в чате», «Сообщить в чат»; без чата — как раньше", () => {
    const s = rd("ui/schedule.jsx");
    expect(s).toMatch(/chatApi\.shiftBoard\(mkey\), nk \? chatApi\.shiftBoard\(nk\) : null/);
    expect(s).toMatch(/chat\.api\.shiftTake\(r\.msg\)/);
    expect(s).toMatch(/chat\.api\.shiftNeed\(null, \{ date: isoDay\(mkey, args\.day\), pos: args\.pos, k: args\.k, n: args\.n \|\| 1, instead: args\.instead \|\| null \}\)/);
    expect(s).toMatch(/chat\.open\(\{ kind: "give", date: isoDay\(mkey, dSel\) \}\)/);
    expect(s).toMatch(/chat\.api\.cardSend\(null, what === "wishes" \? \{ t: "sched", what: "wishes", month: mkey, until \} : \{ t: "sched", month: mkey \}\)/);
    expect(s).toMatch(/if \(!board\) for \(let d = td0; d <= DAYS; d\+\+\)/);              // старый «Предложить обмен» — только без чата
    expect(s).toMatch(/disabled=\{dirty \|\| !!\(st && st\.busy\)\}/);                       // несохранённое — сначала «Сохранить»
    expect(s).toMatch(/if \(!m \|\| !m\.payload \|\| dirtyNow\.current\) return;/);            // тихое перечитывание не трогает правки
  });
  it("Меню: стоп после публикации — в чат; Колода, Колода бармена, Справочник, урок — «Поделиться в чат»", () => {
    const mt = rd("ui/menu-trainer.jsx");
    expect(mt).toMatch(/\.then\(\(ok\) => \{ if \(ok\) stopToChat\(d\.id, stopped\); \}\);/);
    expect(mt).toMatch(/rpc\("chat_stop_note", \{ p_token: saToken\(\), p_dish: String\(dishId\), p_on: !!on \}\)/);
    expect(rd("ui/menu-deck.jsx")).toMatch(/onShareChat\(dishShareItem\(d\)\)/);
    expect(rd("ui/cocktails.jsx")).toMatch(/onShareChat\(cocktailShareItem\(c\)\)/);
    expect(rd("ui/ReferenceSection.jsx")).toMatch(/onShareChat\(refShareItem\(lesson, course\.title\)\)/);
    expect(rd("ui/screens-learning.jsx")).toMatch(/onShareChat\(lessonShareItem\(lesson, mod\)\)/);
    expect(rd("ui/briefing.jsx")).toMatch(/rpc\("chat_card_send", \{ p_token: saToken\(\), p_chat: null, p_card: \{ t: "brief", date: data\.day,/);
  });
  it("чат: «Поделиться в чат» из приложения, лист смены с днём, карточка коллеги", () => {
    const c = rd("ui/chat.jsx");
    expect(c).toMatch(/if \(it\.kind === "share" && it\.item\) \{ setCurId\(null\); setPicker\(false\); setShareItem\(it\.item\); return; \}/);
    expect(c).toMatch(/api\.cardSend\(c\.id, \{ t: "share", item, note: note\.trim\(\) \}\)/);
    expect(c).toMatch(/function PersonSheet\(/);
    expect(rd("ui/chat-cards.jsx")).toMatch(/if \(date\) \{ const s = l\.find\(\(x\) => x && x\.date === date\); if \(s\) setPick\(s\); \}/);
  });
  it("тексты v97 без ритма « — », без эмодзи; значок «в чат» — линией", () => {
    for (const f of ["lib/share-items.js", "lib/schedule-chat.js", "ui/share-chat.jsx"]) {
      const s = rd(f);
      expect((strs(s).match(DASH) || []).length, f).toBe(0);
      expect(EMOJI.test(s), f).toBe(false);
    }
    expect(rd("ui/share-chat.jsx")).toMatch(/fill="none" stroke=\{color\}/);
  });
  it("демо: сборка с относительными путями, сервер в странице, строка «Демо»; e2e-v97; документы", () => {
    expect(existsSync("tools/claude/demo-app/build.mjs") && existsSync("tools/claude/demo-app/boot.js")).toBe(true);
    const b = rd("tools/claude/demo-app/boot.js");
    expect(b).toMatch(/window\.fetch = function/);
    expect(b).toMatch(/\/\\\/rest\\\/v1\\\/rpc\\\/\(\[a-z_0-9\]\+\)\//);
    expect(rd("tools/claude/demo-app/build.mjs")).toMatch(/"serviceWorker" in navigator', "false"/);
    expect(existsSync("tools/claude/e2e-v97.mjs")).toBe(true);
    expect(rd("tools/claude/README.md")).toMatch(/e2e-v97\.mjs/);
    expect(rd("CHANGES.md")).toMatch(/# Дополнение 410 — /);
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(9[6-9]|\d{3,})<\/span>/);
  });
});
