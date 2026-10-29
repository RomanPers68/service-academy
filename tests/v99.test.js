// v99 (Доп. 412): удобство каждый день. Вход через Telegram без кода, упоминания «@Имя» и «@все», черновик в чате,
// поиск по переписке, «Опаздываю» одним нажатием, смены в календаре телефона, экран «Сервер» у владельца, кнопка
// «Академия» и команды у бота. Сервер — этап 39 (supabase/supabase-stage39-everyday.sql, проверка в живом Postgres —
// tools/claude/sql/test39.sh), вид — tools/claude/e2e-v99.mjs. Здесь — расчёт (lib/*) и швы между файлами.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const SQL = rd("supabase/supabase-stage39-everyday.sql");
const fnsOf = (sql) => [...sql.matchAll(/create or replace function (?:public\.)?([a-z_0-9]+)\s*\(/gi)].map((m) => m[1].toLowerCase());

describe("v99: упоминания в чате (lib/chat-mention.js)", () => {
  const members = [{ id: 1, name: "Анна Смирнова", pos: "waiter" }, { id: 2, name: "Анна Петрова", pos: "host" },
    { id: 3, name: "Мария Иванова", pos: "manager" }, { id: 4, name: "Ёлка", pos: "bar" }, { id: 5, name: "", pos: "x" }];
  it("имена: у тёзок имя и буква фамилии (как на сервере, _sa_chat_ment_names), без пустых имён", async () => {
    const M = await import("../lib/chat-mention.js");
    expect(M.mentionNames(members).map((n) => [n.id, n.disp])).toEqual([["1", "Анна С."], ["2", "Анна П."], ["3", "Мария"], ["4", "Ёлка"]]);
    expect(SQL).toContain("create or replace function _sa_chat_ment_names(ch sa_chats)");
  });
  it("что набирают после «@»: в начале, после пробела и скобки; почта — не упоминание", async () => {
    const M = await import("../lib/chat-mention.js");
    expect(M.mentionQuery("Привет @Ан", 10)).toEqual({ start: 7, q: "Ан" });
    expect(M.mentionQuery("@Анна С", 7)).toEqual({ start: 0, q: "Анна С" });   // тёзки: имя и буква
    expect(M.mentionQuery("(@ма", 4)).toEqual({ start: 1, q: "ма" });
    expect(M.mentionQuery("@", 1)).toEqual({ start: 0, q: "" });
    expect(M.mentionQuery("anna@mail", 9)).toBe(null);
    expect(M.mentionQuery("@" + "а".repeat(30))).toBe(null);
  });
  it("подсказки: без меня, «все» только руководителю и старшему, Наставник везде, ё как е", async () => {
    const M = await import("../lib/chat-mention.js");
    const N = M.mentionNames(members);
    expect(M.mentionSuggest(N, "ан", { meId: 1 }).map((x) => x.disp)).toEqual(["Анна П."]);
    expect(M.mentionSuggest(N, "", { meId: 3, lead: true }).map((x) => x.disp)).toEqual(["все", "Анна П.", "Анна С.", "Ёлка", "Наставник"]);
    expect(M.mentionSuggest(N, "", { meId: 1, lead: false }).map((x) => x.disp)).toEqual(["Анна П.", "Ёлка", "Мария", "Наставник"]);
    expect(M.mentionSuggest(N, "в", { meId: 3, lead: true }).map((x) => x.kind)).toEqual(["all"]);
    expect(M.mentionSuggest(N, "ел").map((x) => x.disp)).toEqual(["Ёлка"]);
    expect(M.mentionSuggest(N, "на", { group: false }).map((x) => x.kind)).toEqual(["ai"]);   // личная переписка: только Наставник
    expect(M.mentionSuggest(N, "иван").map((x) => x.disp)).toEqual(["Мария"]);                // по фамилии тоже
  });
  it("вставка «@Имя » вместо набранного, каретка за пробелом", async () => {
    const M = await import("../lib/chat-mention.js");
    expect(M.mentionInsert("Привет @Ан как дела", 7, 10, "Анна С.")).toEqual({ text: "Привет @Анна С. как дела", caret: 16 });
    expect(M.mentionInsert("@", 0, 1, "все")).toEqual({ text: "@все ", caret: 5 });
  });
  it("подсветка: «@Имя» и «@все» от руководителя; «@все» не руководителя и почта — обычный текст", async () => {
    const M = await import("../lib/chat-mention.js");
    const N = M.mentionNames(members);
    expect(M.mentionParts("@Анна С. посмотри, @все на брифинг, anna@x @Мария", N, { meId: 1, leadAuthor: true })).toEqual([
      { t: "at", s: "@Анна С.", id: "1", me: true }, { t: "s", s: " посмотри, " }, { t: "at", s: "@все", id: "all", me: true },
      { t: "s", s: " на брифинг, anna@x " }, { t: "at", s: "@Мария", id: "3", me: false }]);
    expect(M.mentionParts("@все на брифинг", N, { meId: 1, leadAuthor: false })).toEqual([{ t: "s", s: "@все на брифинг" }]);
    expect(M.mentionParts("@елка привет", N, { meId: 4 })[0]).toEqual({ t: "at", s: "@елка", id: "4", me: true });
    expect([M.mentionsMe("@Анна П. привет", N, 2), M.mentionsMe("@Анна П. привет", N, 1), M.mentionsMe("@все", N, 1, true), M.mentionsMe("@все", N, 1, false)])
      .toEqual([true, false, true, false]);
    expect([M.isLeadPos("manager"), M.isLeadPos("senior"), M.isLeadPos("waiter"), M.isLeadPos("")]).toEqual([true, true, false, false]);
  });
  it("сервер: разбор при записи и правке, бот упомянутым, «@все» не чаще раза в 10 минут, ment в списке чатов", () => {
    expect(SQL).toContain("alter table sa_chat_msgs add column if not exists mentions text[]");
    expect(SQL).toMatch(/create trigger sa_chat_ment\b[\s\S]{0,200}before insert or update of body/);
    expect(SQL).toMatch(/create trigger sa_chat_ment_ping\b[\s\S]{0,120}after insert on sa_chat_msgs/);
    expect(SQL).toContain("interval '10 minutes'");
    expect(SQL).toContain("'ment',");
  });
});

describe("v99: черновик в чате (lib/chat-draft.js)", () => {
  const mk = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
  const now = 1_800_000_000_000;
  it("текст и ответ на сообщение ждут неделю, отдельно для человека и чата; в списке — одна строка", async () => {
    const D = await import("../lib/chat-draft.js");
    const ls = mk();
    D.draftSet("e1", 7, "Привет,\n  как   дела", 55, now, ls);
    expect(D.draftGet("e1", 7, now, ls)).toEqual({ t: "Привет,\n  как   дела", r: 55 });
    expect(D.draftLine("e1", 7, now, ls)).toBe("Привет, как дела");
    expect([...ls.m.keys()]).toEqual(["sa_chat_draft:e1:7"]);
    expect(D.draftGet("e2", 7, now, ls)).toBe(null);
    expect(D.draftGet("e1", 7, now + 8 * 86400000, ls)).toBe(null);   // старше недели — стёрт
    expect([...ls.m.keys()]).toEqual([]);
  });
  it("пустой текст без ответа стирает; только ответ — черновик без строки в списке; не больше 1200 знаков", async () => {
    const D = await import("../lib/chat-draft.js");
    const ls = mk();
    D.draftSet("e1", 7, "x", null, now, ls); D.draftSet("e1", 7, "   ", null, now, ls);
    expect([...ls.m.keys()]).toEqual([]);
    D.draftSet("e1", 7, "", 12, now, ls);
    expect(D.draftGet("e1", 7, now, ls)).toEqual({ t: "", r: 12 });
    expect(D.draftLine("e1", 7, now, ls)).toBe("");
    D.draftClear("e1", 7, ls);
    expect(D.draftGet("e1", 7, now, ls)).toBe(null);
    D.draftSet("e1", 8, "x".repeat(1500), null, now, ls);
    expect(D.draftGet("e1", 8, now, ls).t.length).toBe(1200);
  });
  it("без хранилища или с ошибкой хранилища — молча", async () => {
    const D = await import("../lib/chat-draft.js");
    const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("y"); } };
    expect(D.draftGet("e1", 8, now, bad)).toBe(null);
    expect(() => { D.draftSet("e1", 8, "x", null, now, bad); D.draftClear("e1", 8, bad); }).not.toThrow();
    expect(D.draftGet(null, 8, now, mk())).toBe(null);
    expect(D.draftGet("e1", 8, now, null)).toBe(null);
  });
  it("экран: черновик в строке ввода с первого кадра, «Черновик:» в списке, на время правки откладывается", () => {
    const c = rd("ui/chat.jsx");
    expect(c).toContain('import { draftGet, draftSet, draftClear, draftLine } from "../lib/chat-draft";');
    expect(c).toContain('<span className="dr">Черновик:</span>');
    expect(c).toContain("const stashRef = React.useRef(null);");
  });
});

describe("v99: поиск по переписке (lib/chat-search.js, chat_search)", () => {
  it("запрос от 2 знаков, пробелы схлопнуты, до 80 знаков", async () => {
    const S = await import("../lib/chat-search.js");
    expect([S.searchQuery("  а "), S.searchQuery("  тар   тар "), S.searchQuery("x".repeat(100)).length]).toEqual(["", "тар тар", 80]);
  });
  it("кусок вокруг найденного: многоточие по краям, регистр и ё не важны", async () => {
    const S = await import("../lib/chat-search.js");
    expect(S.searchSnippet("Сегодня на банкете будет тартар из говядины и ещё много всего вкусного, что надо проверить до открытия зала вечером", "ТАРТАР", 60))
      .toEqual({ pre: "… на банкете будет ", hit: "тартар", post: " из говядины и ещё много всего вкусн…" });
    expect(S.searchSnippet("Короткий текст про Ёлку", "елку")).toEqual({ pre: "Короткий текст про ", hit: "Ёлку", post: "" });
    expect(S.searchSnippet("Карточка", "подпись")).toEqual({ pre: "Карточка", hit: "", post: "" });
    expect(S.searchSnippet("x".repeat(120), "zz", 50).pre).toBe("x".repeat(49) + "…");
  });
  it("клиент и сервер: chat_search(p_token, p_q, p_chat); лупа в списке чатов и в открытом чате", () => {
    expect(rd("lib/chat-api.js")).toContain('search: (q, chat = null) => call("chat_search", { p_q: String(q || ""), p_chat: chat == null ? null : chat }),');
    expect(SQL).toContain("create or replace function chat_search(p_token text, p_q text, p_chat bigint default null)");
    const c = rd("ui/chat.jsx");
    expect(c).toContain('data-chat-searchbtn=""');
    expect(c).toContain('data-chat-tsearch=""');
    expect(c).toContain("Поиск заработает, когда руководитель обновит сервер (этап 39).");
    expect(c).toContain(".ch-q::-webkit-search-cancel-button,.ch-q::-webkit-search-decoration{-webkit-appearance:none;appearance:none;display:none}");   // свой золотой «×»
    expect(c).toContain('className="ch-qx" data-chat-qx=""');
  });
});

describe("v99: «Опаздываю» (lib/late.js, chat_late)", () => {
  const at = (h, m) => new Date(2026, 9, 28, h, m, 0);
  it("минуты словами — как _sa_late_min на сервере; подписи на кнопках", async () => {
    const L = await import("../lib/late.js");
    expect(L.LATE_MINS.map(L.lateMinText)).toEqual(["5 минут", "10 минут", "15 минут", "20 минут", "30 минут", "45 минут", "час", "полтора часа"]);
    expect(L.LATE_MINS.map(L.lateChip)).toEqual(["5 мин", "10 мин", "15 мин", "20 мин", "30 мин", "45 мин", "1 ч", "1,5 ч"]);
    expect([1, 2, 21, 120, 180, 300].map(L.lateMinText)).toEqual(["1 минуту", "2 минуты", "21 минуту", "2 часа", "3 часа", "5 часов"]);
    expect(SQL).toMatch(/when n = 60 then 'час'[\s\S]{0,80}when n = 90 then 'полтора часа'/);
  });
  it("время прихода: до начала смены — от начала, после — от сейчас, без смены — от сейчас", async () => {
    const L = await import("../lib/late.js");
    expect([L.lateEta(10, 15, at(9, 0)), L.lateEta(10, 15, at(10, 20)), L.lateEta(null, 30, at(23, 50)), L.lateEta(16, 90, at(15, 0))])
      .toEqual(["10:15", "10:35", "00:20", "17:30"]);
    expect([L.hhmmOf(10.25), L.hhmmOf(24), L.hhmmOf(25.5), L.hhmmOf(9)]).toEqual(["10:15", "00:00", "01:30", "09:00"]);
    expect(SQL).toContain("base := greatest(today + make_interval(mins => round(st * 60)::int), nowl);");
  });
  it("когда предлагать: за 3 часа до начала и до 2 часов после; выходной и нет смены — нет", async () => {
    const L = await import("../lib/late.js");
    const sh = { off: false, from: 16 };
    expect([L.lateWindow(sh, at(13, 0)), L.lateWindow(sh, at(12, 59)), L.lateWindow(sh, at(18, 0)), L.lateWindow(sh, at(18, 1)),
      L.lateWindow({ off: true, from: 16 }, at(15, 0)), L.lateWindow(null, at(15, 0)), L.lateWindow({ from: "16" }, at(15, 0))])
      .toEqual([true, false, true, false, false, false, false]);
  });
  it("карточка: «Принято» у руководителя, автор ждёт, после ответа — кто принял", async () => {
    const L = await import("../lib/late.js");
    const card = { min: 15, eta: "10:15", from: "10:00", label: "Утро", note: "пробка" };
    expect(L.lateView(card, { id: 3, lead: true }, 1)).toEqual({ title: "Буду в 10:15", sub: "Смена «Утро» с 10:00 · опоздание на 15 минут", note: "пробка", ok: "", act: "ok", wait: false });
    expect(L.lateView(card, { id: 1, lead: false }, 1)).toMatchObject({ act: null, wait: true });
    expect(L.lateView({ ...card, ok: { id: 3, name: "Мария Иванова" } }, { id: 1 }, 1)).toMatchObject({ ok: "Мария И.", act: null, wait: false });
    expect(L.lateView({ min: 60, eta: "11:00" }, { id: 2, lead: false }, 1)).toMatchObject({ sub: "Опоздание на час", act: null, wait: false });
    expect([L.lateSummary(card), L.lateSummary({ min: 90, eta: "12:00" })]).toEqual(["Опаздываю на 15 минут: буду в 10:15. пробка", "Опаздываю на полтора часа: буду в 12:00"]);
    expect(SQL).toContain("body := 'Опаздываю на ' || _sa_late_min(p_min) || ': буду в ' || etas || coalesce('. ' || nullif(note, ''), '');");
  });
  it("плитка «Опаздываю» в «+» — в «Вся команда» и своих чатах; бот руководителям в смене с кнопкой «Принято»", async () => {
    const S = await import("../lib/chat-smart.js");
    expect(S.actTiles({ lead: false }, { kind: "team" }).map((t) => t.id)).toEqual(["photo", "late", "give", "swap", "share", "poll", "ai"]);
    expect(S.actTiles({ lead: false }, { kind: "group" }).map((t) => t.id)).toContain("late");
    expect(S.actTiles({ lead: true }, { kind: "dm" }).map((t) => t.id)).not.toContain("late");
    expect(S.actTiles({ lead: false }, { kind: "lead" }).map((t) => t.id)).not.toContain("late");
    expect(rd("lib/chat-api.js")).toContain('late: (chat, min, note = "") => call("chat_late", { p_chat: chat == null ? null : chat, p_min: Number(min) || 0, p_note: note || "" }),');
    expect(rd("lib/chat-api.js")).toContain('lateOk: (msg) => call("chat_late_ok", { p_msg: msg }),');
    expect(SQL).toContain("who := case when cardinality(onl) > 0 then onl else leads end;");
    expect(SQL).toContain("jsonb_build_object('text', 'Принято', 'callback_data', 'cl:' || m.id)");
  });
  it("приложение: на главной «Опаздываю?», в «Смене» строка, лист в чате; в «Графике» отметки (late_month)", () => {
    const app = rd("App.jsx");
    expect(app).toContain("const lateOn = !!(chatOn && profile && profile.restaurant && lateWindow(shiftToday, new Date()));");
    expect(app).toContain('const openLate = () => openChatWith({ kind: "late" });');
    expect(app).toContain('lateRow={lateOn ? { key: "late", label: "Опаздываю?", title: "предупредить", onClick: openLate } : null}');
    expect(app).toContain('lateOn && { key:"late", group:"На смене", icon:"late", label:"Опаздываю"');
    const chat = rd("ui/chat.jsx");
    expect(chat).toContain('if (it.kind === "give" || it.kind === "swap" || it.kind === "late") wantRef.current = it;');
    expect(chat).toContain('if (k === "late") { setSheet("late"); return; }');
    expect(rd("ui/chat-cards.jsx")).toContain('<Sheet title="Опаздываю" data={{ "data-chat-latesheet": "" }} onClose={onClose}>');
    // в «+» — во всю ширину под плитками: сетка ровная (3×3 у руководителя, 3×2 у сотрудника)
    expect(rd("ui/chat-cards.jsx")).toContain('<button type="button" className="ch-tile wide" data-chat-act="late"');
    expect(rd("ui/chat-cards.jsx")).toContain(".ch-tile.wide{grid-column:1/-1;");
    expect(rd("ui/schedule.jsx")).toContain('rpc("late_month", { p_token: saToken(), p_month: mkey })');
    const sch = rd("ui/schedule.jsx");   // «Сегодня» у руководителя: значок у лица и строка «опаздывает: … к 12:20 (принято)»
    expect(sch).toContain("data-today-late={o.who.id}");
    expect(sch).toContain('{ll.length > 1 ? "опаздывают: " : "опаздывает: "}{ll.map(y => y.x.name + " к " + y.l.eta + (y.l.ok ? " (принято)" : "")).join(", ")}');
    expect(sch).toContain("опоздает, к {lt.eta}");
    expect(rd("ui/chat-cards.jsx")).toContain('<St wait data-chat-late-wait="">Ждём ответа руководителя</St>');
    expect(SQL).toContain("create or replace function late_month(p_token text, p_month text)");
  });
});

describe("v99: смены в календаре телефона (lib/ical.js, api/cal.js, cal_feed)", () => {
  it("поля по RFC 5545: экранирование, местное время без пояса, ночная смена — на следующий день", async () => {
    const I = await import("../lib/ical.js");
    expect(I.icsEscape("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect([I.icsLocal("2026-10-28", 10), I.icsLocal("2026-10-28", 26), I.icsLocal("2026-10-31", 24.5), I.icsLocal("bad", 1)])
      .toEqual(["20261028T100000", "20261029T020000", "20261101T003000", ""]);
  });
  it("длинная строка — по 75 байт UTF-8, кириллица не рвётся, склейка даёт исходное", async () => {
    const I = await import("../lib/ical.js");
    const long = "DESCRIPTION:" + "Смена ".repeat(30), f = I.icsFold(long);
    expect(f.split("\r\n").every((s) => Buffer.byteLength(s) <= 75)).toBe(true);
    expect(f.split("\r\n").slice(1).every((s) => s.startsWith(" "))).toBe(true);
    expect(f.replace(/\r\n /g, "")).toBe(long);
  });
  it("файл: события по сменам (UID — человек и день), заведение, напоминание за час; кривые строки пропущены", async () => {
    const I = await import("../lib/ical.js");
    const ics = I.buildIcs({ id: "e7", name: "Анна Смирнова", rest: "Рома, бар", tz: "Europe/Moscow", app: "https://x.vercel.app/",
      shifts: [{ date: "2026-10-28", k: "в", label: "Вечер", from: 16, to: 24, pos: "официант" }, { date: "2026-10-29", label: "Ночь", from: 22, to: 2, pos: "бар" },
        { date: "bad", from: 1, to: 2 }, { date: "2026-10-30", from: "x", to: 2 }] }, new Date(Date.UTC(2026, 9, 28, 7, 5, 9)));
    const flat = ics.replace(/\r\n /g, "");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((s) => Buffer.byteLength(s) <= 75)).toBe(true);
    expect((flat.match(/BEGIN:VEVENT/g) || []).length).toBe(2);
    expect(flat).toContain("X-WR-CALNAME:Смены · Рома\\, бар\r\nX-WR-TIMEZONE:Europe/Moscow");
    expect(flat).toContain("UID:sa-e7-2026-10-28@service-academy\r\nDTSTAMP:20261028T070509Z\r\nDTSTART:20261028T160000\r\nDTEND:20261029T000000\r\nSUMMARY:Смена: вечер\r\nLOCATION:Рома\\, бар");
    expect(flat).toContain("DESCRIPTION:Официант · 16:00–24:00\\nГрафик в приложении: https://x.vercel.app/?go=schedule");
    expect(flat).toContain("DTSTART:20261029T220000\r\nDTEND:20261030T020000\r\nSUMMARY:Смена: ночь");
    expect(flat).toContain("BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Через час смена\r\nTRIGGER:-PT1H\r\nEND:VALARM");
    expect(I.buildIcs(null)).toMatch(/^BEGIN:VCALENDAR[\s\S]*END:VCALENDAR\r\n$/);
  });
  it("страница «Подписаться»: webcal-ссылка, ссылка для Google Календаря, имя и смены экранированы", async () => {
    const I = await import("../lib/ical.js");
    const p = I.calPage({ name: "Анна Смирнова", rest: "Рома", https: "https://x.vercel.app/api/cal?k=abc", next: ["сегодня <b>", "завтра", "3", "4"] });
    expect(p).toContain('<a class="btn" href="webcal://x.vercel.app/api/cal?k=abc">Добавить в календарь</a>');
    expect(p).toContain('value="https://x.vercel.app/api/cal?k=abc"');
    expect(p).toContain("<h1>Смены · Анна в календаре</h1>");
    expect(p).toContain("<li>сегодня &lt;b&gt;</li>");
    expect(p).not.toContain("<li>4</li>");
    expect(p).not.toMatch(/ — /);
  });
  it("функция Vercel: ключ из 32 знаков, файл text/calendar, page=1 — страница; ключа нет — 404", () => {
    const f = rd("api/cal.js");
    expect(f).toContain('import { buildIcs, calPage } from "../lib/ical.js";');
    expect(f).toContain("if (!/^[0-9a-f]{32}$/.test(k)) return text(400,");
    expect(f).toContain("fetch(`${SUPABASE_URL}/rest/v1/rpc/cal_feed`");
    expect(f).toContain('res.setHeader("Content-Type", "text/calendar; charset=utf-8");');
    expect(f).toContain('if (!data || data.ok !== true) return text(404,');
    expect(SQL).toContain("create or replace function cal_feed(p_key text, p_page boolean default false)");
    expect(SQL).toContain("if not coalesce(p_page, false) then update sa_cal_keys set used_at = now() where k = p_key; end if;");
    expect(f).toContain("body: JSON.stringify({ p_key: k, p_page: page }),");   // страница «Подписаться» — не календарь
    expect(SQL).toContain("create or replace function cal_key(p_token text, p_reset boolean default false)");
    expect(rd("ui/cal-sheet.jsx")).toContain('rpc("cal_key", { p_token: saToken(), p_reset: !!reset })');
    expect(rd("ui/cal-sheet.jsx")).toContain("Напоминание о смене по-прежнему придёт в Telegram.");
  });
  it("приложение: «Смены в календаре телефона» в «Смене» и в «Графике», лист — отдельным куском", () => {
    const app = rd("App.jsx");
    expect(app).toContain('const CalSheet = lazyOf(() => import("./ui/cal-sheet"), "CalSheet");');
    expect(app).toContain('profile.restaurant && { key:"cal", group:"На смене", icon:"calendar", label:"Смены в календаре телефона"');
    expect(app).toContain("onCal={() => setCalOpen(true)}");
    expect(app).toContain('cal: set("cal") };');
    expect(rd("ui/schedule.jsx")).toContain("data-cal-phone");
  });
});

describe("v99: функция Vercel /api/cal (api/cal.js) — ответы по ключу", () => {
  const mkRes = () => { const r = { code: 0, h: {}, body: "" }; r.status = (c) => { r.code = c; return r; }; r.setHeader = (k, v) => { r.h[k.toLowerCase()] = v; }; r.send = (b) => { r.body = String(b); return r; }; return r; };
  const KEY = "0123456789abcdef0123456789abcdef";
  const FEED = { ok: true, id: "e7", name: "Анна Смирнова", rest: "Два моря", tz: "Europe/Moscow", app: "https://sa.example",
    shifts: [{ date: "2099-01-05", k: "Д", label: "День", from: 12, to: 20, time: "12:00–20:00", pos: "официант" }] };
  let sent = [];
  const stub = (resp, status = 200) => { sent = []; globalThis.fetch = async (url, o) => { sent.push([url, JSON.parse(o.body)]); return { ok: status === 200, status, json: async () => resp }; }; };
  it("календарь: text/calendar, без кэша; cal_feed с p_page: false", async () => {
    const { default: handler } = await import("../api/cal.js");
    stub(FEED);
    const res = mkRes();
    await handler({ method: "GET", query: { k: KEY }, headers: {} }, res);
    expect([res.code, res.h["content-type"], res.h["cache-control"]]).toEqual([200, "text/calendar; charset=utf-8", "no-store"]);
    expect(res.body).toContain("SUMMARY:Смена: день");
    expect(sent[0][0]).toMatch(/\/rest\/v1\/rpc\/cal_feed$/);
    expect(sent[0][1]).toEqual({ p_key: KEY, p_page: false });
  });
  it("страница «Подписаться» (page=1): html с webcal по адресу сайта; p_page: true — «забирал смены» не отмечается", async () => {
    const { default: handler } = await import("../api/cal.js");
    stub(FEED);
    const res = mkRes();
    await handler({ method: "GET", query: { k: KEY, page: "1" }, headers: { host: "sa.example", "x-forwarded-proto": "https" } }, res);
    expect([res.code, res.h["content-type"]]).toEqual([200, "text/html; charset=utf-8"]);
    expect(res.body).toContain('href="webcal://sa.example/api/cal?k=' + KEY + '"');
    expect(res.body).toContain("<li>пн, 5 января · день 12:00–20:00</li>");
    expect(sent[0][1]).toEqual({ p_key: KEY, p_page: true });
  });
  it("кривой ключ — 400 без запроса; ключа нет — 404; сервер без этапа — 502 с подсказкой; не GET — 405", async () => {
    const { default: handler } = await import("../api/cal.js");
    stub(FEED);
    let res = mkRes(); await handler({ method: "GET", query: { k: "abc" }, headers: {} }, res);
    expect([res.code, sent.length]).toEqual([400, 0]);
    stub({ ok: false, error: "key" });
    res = mkRes(); await handler({ method: "GET", query: { k: KEY }, headers: {} }, res);
    expect(res.code).toBe(404);
    expect(res.body).toContain("Ссылка больше не работает");
    stub({ message: "Could not find the function public.cal_feed" }, 404);
    res = mkRes(); await handler({ method: "GET", query: { k: KEY }, headers: {} }, res);
    expect([res.code, /нужен этап 39/.test(res.body)]).toEqual([502, true]);
    res = mkRes(); await handler({ method: "POST", query: {}, headers: {} }, res);
    expect(res.code).toBe(405);
  });
});

describe("v99: экран «Сервер» у владельца (lib/server-check.js, server_check)", () => {
  it("каждый этап из списка есть в supabase/, и его функция в нём объявлена", async () => {
    const R = await import("../lib/server-check.js");
    for (const s of R.STAGES) {
      const p = "supabase/" + s.file;
      expect(existsSync(p), p).toBe(true);
      if (s.fn) expect(fnsOf(rd(p)), s.file + " → " + s.fn).toContain(s.fn);
      if (s.bucket) expect(rd(p), s.file + " → " + s.bucket).toContain("'" + s.bucket + "'");
    }
    const ns = R.STAGES.map((s) => s.n);   // v106: после 39 — этап 40 («Утро руководителя»)
    expect(ns.slice(ns.indexOf("37"), ns.indexOf("37") + 3)).toEqual(["37", "38", "39"]);
    expect(R.stageBuckets()).toEqual(["menu-photos", "menu-voice"]);
  });
  it("расписания pg_cron из списка ставят их этапы", async () => {
    const R = await import("../lib/server-check.js");
    for (const j of R.CRON_JOBS) {
      const s = R.STAGES.find((x) => x.n === j.n);
      expect(rd("supabase/" + s.file), j.name).toContain("'" + j.name + "'");
    }
  });
  it("«сколько назад» словами", async () => {
    const R = await import("../lib/server-check.js");
    const now = Date.UTC(2026, 9, 28, 12, 0, 0);
    expect(["", "2026-10-28T11:59:30Z", "2026-10-28T11:55:00Z", "2026-10-28T11:39:00Z", "2026-10-28T09:00:00Z", "2026-10-27T10:00:00Z", "2026-10-24T12:00:00Z",
      "2026-10-07T12:00:00Z", "2026-09-01T12:00:00Z", "x"].map((t) => R.agoText(t, now)))
      .toEqual(["", "только что", "5 минут назад", "21 минуту назад", "3 часа назад", "вчера", "4 дня назад", "21 день назад", "давно", ""]);
  });
  it("разбор ответа: всё на месте — 0 дел; нет этапов, вебхука и расписаний — по делу на каждое", async () => {
    const R = await import("../lib/server-check.js");
    const now = Date.UTC(2026, 9, 28, 12, 0, 0), all = R.stageFns();
    const ok = R.serverReport({ fns: all, buckets: ["menu-photos", "menu-voice"], cron: R.CRON_JOBS.map((j) => ({ name: j.name, on: true })),
      tg: { bot: true, name: "sa_bot", hook: true, last: "2026-10-28T11:00:00Z", linked: 5, auth: 3 }, staff: 12, app: "https://x", pg_net: true, tz: "Europe/Moscow" }, now);
    expect([ok.todo, ok.missing.length, ok.cronMissing.length, ok.tg, ok.app, ok.net, ok.tz])
      .toEqual([0, 0, 0, { bot: true, name: "sa_bot", hook: true, last: "2026-10-28T11:00:00Z", ago: "1 час назад", linked: 5, auth: 3, staff: 12 }, "https://x", true, "Europe/Moscow"]);
    const bad = R.serverReport({ fns: all.filter((x) => x !== "cal_feed" && x !== "chat_person"), buckets: null, cron: [{ name: "sa-nudges", on: false }], tg: { bot: true, hook: false } }, now);
    // v106: расписаний стало четыре (+ sa-morning) — все без задачи или выключены, по делу на каждое
    expect([bad.missing.map((s) => s.n), bad.cronMissing.map((j) => j.name), bad.todo]).toEqual([["38", "39"], R.CRON_JOBS.map((j) => j.name), 3 + R.CRON_JOBS.length]);
    const none = R.serverReport(null, now);
    expect([none.cron, none.todo, none.tg.bot]).toEqual([null, R.stageFns().length + 2, false]);
  });
  it("сервер и экран: server_check и owner_tg_setup — только владельцу; экран и пункт «Сервер» — только владельцу", () => {
    expect(SQL).toContain("create or replace function server_check(p_token text, p_fns text[] default null, p_buckets text[] default null, p_url text default null)");
    expect(SQL).toContain("create or replace function owner_tg_setup(p_token text, p_app text default null)");
    const owner = "if not coalesce((c->>'admin')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;";
    expect(SQL.match(/function server_check[\s\S]*?end; \$\$;/)[0]).toContain(owner);
    expect(SQL.match(/function owner_tg_setup[\s\S]*?end; \$\$;/)[0]).toContain(owner);
    const ui = rd("ui/server.jsx");
    expect(ui).toContain('rpc("server_check", { p_token: saToken(), p_fns: stageFns().concat(["server_check"]), p_buckets: stageBuckets(), p_url: SUPABASE_URL })');
    expect(ui).toContain('rpc("owner_tg_setup", { p_token: saToken(), p_app: typeof window !== "undefined" ? window.location.origin : "" })');
    const app = rd("App.jsx");
    expect(app).toContain('const ServerScreen = lazyOf(() => import("./ui/server"), "ServerScreen");');
    expect(app).toContain('{screen === "server" && profile?.is_admin && <div className="sa-tabpad">');
    expect(app).toContain('profile?.is_admin && { key:"srv", group:"Управление", icon:"server", label:"Сервер"');
  });
});

describe("v99: вход через Telegram без кода (lib/tg-login.js, tg_login)", () => {
  let calls = [], answers = {}, store = {}, sess = {};
  beforeEach(() => {
    calls = []; answers = {}; store = {}; sess = {};
    globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    globalThis.sessionStorage = { getItem: (k) => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = String(v); }, removeItem: (k) => { delete sess[k]; } };
    globalThis.window = { Telegram: { WebApp: { initData: "query_id=1&user=%7B%22id%22%3A77%7D&auth_date=1&hash=h", initDataUnsafe: { user: { id: 77 } } } } };
    globalThis.fetch = async (url, opts) => {
      const fn = String(url).split("/rpc/")[1];
      calls.push([fn, JSON.parse(opts.body)]);
      const a = answers[fn];
      return { ok: true, json: async () => (typeof a === "function" ? a() : a === undefined ? { ok: false, error: "x" } : a) };
    };
  });
  it("данные Telegram и id того, кто открыл; без Telegram — пусто", async () => {
    const T = await import("../lib/tg-login.js");
    expect(T.tgInitData()).toBe("query_id=1&user=%7B%22id%22%3A77%7D&auth_date=1&hash=h");
    expect(T.tgUserId()).toBe("77");
    globalThis.window = { __saDemoTg: "user=%7B%22id%22%3A5%7D&hash=z" };
    expect([T.tgInitData(), T.tgUserId()]).toEqual(["user=%7B%22id%22%3A5%7D&hash=z", "5"]);
    globalThis.window = {};
    expect([T.tgInitData(), T.tgUserId()]).toEqual(["", ""]);
  });
  it("вход: сервер узнал — сессия и отметка «уже запомнен»; не узнал — код ошибки; без Telegram — не зовём", async () => {
    const T = await import("../lib/tg-login.js");
    answers.tg_login = { ok: true, token: "tok-123456789012345", employee: { id: "e1", name: "Анна" } };
    const r = await T.tgLogin();
    expect(r.ok).toBe(true);
    expect(calls).toEqual([["tg_login", { p_init_data: "query_id=1&user=%7B%22id%22%3A77%7D&auth_date=1&hash=h" }]]);
    expect(store.sa_tg_bound).toBe("77|456789012345");
    answers.tg_login = { ok: false, error: "not_linked" };
    expect(await T.tgLogin()).toEqual({ ok: false, error: "not_linked" });
    answers.tg_login = { code: "PGRST202", message: "no fn" };
    expect(await T.tgLogin()).toEqual({ ok: false, error: "missing" });
    expect(await T.tgLogin("")).toEqual({ ok: false, error: "no_tg" });
  });
  it("запомнить Telegram: раз на сессию; вышел сам — отметка снята, экран входа сразу не пробует", async () => {
    const T = await import("../lib/tg-login.js");
    answers.tg_auth_bind = { ok: true }; answers.tg_auth_off = { ok: true };
    expect(await T.tgBind("tok-A")).toEqual({ ok: true });
    expect(await T.tgBind("tok-A")).toEqual({ ok: true, again: true });
    expect(calls.map((c) => c[0])).toEqual(["tg_auth_bind"]);
    expect(calls[0][1]).toEqual({ p_token: "tok-A", p_init_data: "query_id=1&user=%7B%22id%22%3A77%7D&auth_date=1&hash=h" });
    expect(T.tgTryLogin()).toBe(true);
    expect(T.tgTryLogin({ startParam: "inv_abc" })).toBe(false);   // ссылка-приглашение — вход по коду
    await T.tgOff("tok-A");
    expect([store.sa_tg_bound, sess.sa_tg_skip, calls[1][0]]).toEqual([undefined, "1", "tg_auth_off"]);
    expect(T.tgTryLogin()).toBe(false);
    expect([T.tgLoginNote("not_linked"), T.tgLoginNote("disabled"), T.tgLoginNote("net")])
      .toEqual(["Войди по коду один раз, дальше приложение будет узнавать тебя по Telegram.", "Доступ отключён. Обратись к руководителю.", ""]);
  });
  it("сервер: подпись Telegram и не старше суток; узнаёт по связке и по напоминаниям; вышел сам — только по коду", () => {
    expect(SQL).toContain("create or replace function tg_login(p_init_data text)");
    expect(SQL).toContain("create or replace function tg_auth_bind(p_token text, p_init_data text)");
    expect(SQL).toContain("create or replace function tg_auth_off(p_token text, p_init_data text)");
    expect(SQL).toMatch(/_sa_tg_check\(p_init/);
    expect(SQL).toMatch(/interval '1 day'|interval '24 hours'|86400/);
    expect(SQL.match(/function tg_login\(p_init_data text\)[\s\S]*?end; \$\$;/)[0]).toContain("tg_links");
  });
  it("экран входа: приглашение — только код в start_param; кнопки бота (go_…) — не код, по ним тоже узнаём по Telegram", () => {
    const t = rd("ui/screens-team.jsx");
    expect(t).toContain("if (!sp || /^go_/.test(sp)) return \"\";");
    expect(t).toContain("return /^[A-ZА-ЯЁ0-9]{2,8}-?[A-ZА-ЯЁ0-9]{1,8}$/i.test(dec) ? dec : \"\";");
    expect(t).toContain('{tgTry ? "Приложение открыто в Telegram: если ты уже входил, код не нужен."');
  });
  it("приложение: экран входа пробует Telegram, после входа по коду запоминает, при выходе — tgOff", () => {
    const app = rd("App.jsx");
    expect(app).toContain('import { tgBind, tgOff } from "./lib/tg-login";');
    expect(app).toContain("if (saToken()) tgBind(saToken()).catch(() => {});");
    expect(app).toContain("tgOff(saToken()).catch(() => {});");
    const t = rd("ui/screens-team.jsx");
    expect(t).toContain('data-tg-login="try"');
    expect(t).toContain('data-tg-login-skip=""');
    expect(t).toMatch(/tgBind\(/);
  });
});

describe("v99: бот — кнопка «Академия», команды, /smena, «Принято» на опоздание", () => {
  const bot = rd("supabase/functions/tg-bot/index.ts");
  it("tg-bot ставит кнопку у поля ввода и команды, только если их ещё нет; токен в ответ не попадает", () => {
    expect(bot).toContain('{ command: "smena", description: "Мои ближайшие смены" },');
    expect(bot).toContain('const MENU_TEXT = "Академия";');
    expect(bot).toContain('if (mbType === "web_app") lines.push("Кнопка у поля ввода уже открывает приложение: не трогаю.");');
    expect(bot).toContain('tg("setChatMenuButton", { menu_button: { type: "web_app", text: MENU_TEXT, web_app: { url: app + "/" } } })');
    expect(bot).toContain('if (cm && cm.ok && Array.isArray(cm.result) && cm.result.length) lines.push(');
    expect(bot).toContain('tg("setMyCommands", { commands: COMMANDS })');
    expect(bot).not.toMatch(/page\([^)]*t\.token/);
    expect(bot).toContain('allowed_updates: ["callback_query", "message"]');   // v81: только нажатия и сообщения
  });
  it("сервер: адрес приложения для кнопки, /smena, «Принято» (cl:), отметка последнего события", () => {
    expect(SQL).toContain("create or replace function sa_tg_setup_take(p_code text, p_use boolean default false)");
    expect(SQL.match(/function sa_tg_setup_take[\s\S]*?end; \$\$;/)[0]).toContain("'app'");
    expect(SQL).toContain("create or replace function _sa_tg_shifts_text(p_emp text)");
    expect(SQL).toContain("create or replace function _sa_late_tg_cb(cq jsonb)");
    expect(SQL).toMatch(/if mt ~\* '\^\/\(smena\|smeny\|shifts\)\(@\[a-z0-9_\]\+\)\?\(\\s\|\$\)' and chat is not null then|if _sa_tg_is_shifts\(mt\) and chat is not null then/);   // v100: и словами (tests/v100.test.js)
    expect(SQL).toContain("tg_last_update");
  });
});

describe("v99: этап 39 целиком", () => {
  it("повторный запуск безопасен, ничего не удаляет; публичные функции открыты, служебные закрыты", () => {
    expect(SQL).toContain("-- Нужны этапы 21, 22б, 24, 25, 31 и 38. Ничего не удаляет. Можно запускать повторно.");
    expect(SQL).not.toMatch(/\bdrop table\b/i);
    expect(SQL).not.toMatch(/\btruncate\b/i);
    for (const f of fnsOf(SQL).filter((x) => x.startsWith("_sa_"))) expect(SQL, f).toContain("revoke all on function " + f + "(");
    for (const f of ["tg_login", "tg_auth_bind", "tg_auth_off", "chat_search", "chat_late", "chat_late_ok", "late_month", "cal_key", "cal_feed", "server_check", "owner_tg_setup"]) {
      expect(fnsOf(SQL), f).toContain(f);
      expect(SQL.match(/grant execute on function tg_login\(text\)[\s\S]*?to anon, authenticated;/)[0], f).toContain(f + "(");
    }
    expect(SQL).toContain("' функций из 11 · таблицы: '");
    expect(SQL).toContain("notify pgrst, 'reload schema';");
  });
  it("клиент зовёт функции этапа 39 с теми параметрами, что объявлены на сервере", () => {
    const sig = (fn) => { const m = new RegExp("create or replace function " + fn + "\\(([^)]*)\\)").exec(SQL); return m ? [...m[1].matchAll(/(p_[a-z_]+)/g)].map((x) => x[1]).sort() : null; };
    const calls = [
      ["lib/tg-login.js", "tg_login"], ["lib/tg-login.js", "tg_auth_bind"], ["lib/tg-login.js", "tg_auth_off"], ["ui/cal-sheet.jsx", "cal_key"],
      ["ui/server.jsx", "server_check"], ["ui/server.jsx", "owner_tg_setup"], ["ui/schedule.jsx", "late_month"],
      ["lib/chat-api.js", "chat_search"], ["lib/chat-api.js", "chat_late"], ["lib/chat-api.js", "chat_late_ok"],
    ];
    for (const [file, fn] of calls) {
      const src = rd(file), m = new RegExp("(?:rpc|call)\\(\"" + fn + "\", \\{([^}]*)\\}").exec(src);
      expect(m, file + " → " + fn).not.toBe(null);
      const keys = [...m[1].matchAll(/(p_[a-z_]+):/g)].map((x) => x[1]);
      if (file === "lib/chat-api.js") keys.push("p_token");   // call() в chat-api добавляет токен сам
      expect(keys.sort(), fn).toEqual(sig(fn));
    }
    expect(rd("lib/chat-api.js")).toMatch(/p_token: saToken\(\)/);
  });
});

describe("v99: гид и тексты", () => {
  it("в гиде: упоминания, поиск и черновики, «Опаздываю», календарь, вход через Telegram; «Сервер» — только владельцу", async () => {
    const { GUIDE } = await import("../ui/guide.jsx");
    const items = GUIDE.flatMap((s) => s.items.map((it) => ({ ...it, tab: s.tab })));
    const by = (k) => items.find((it) => it.key === k);
    expect([by("chatplus").tab, by("late").tab, by("phonecal").tab, by("tglogin").tab, by("server").tab]).toEqual(["Смена", "Смена", "Смена", "Я", "Я"]);
    expect([by("chatplus").go, by("late").go, by("phonecal").go, by("tglogin").go, by("server").go]).toEqual(["chat", "shift", "shift", "profile", "server"]);
    expect(by("server").admin).toBe(true);
    for (const k of ["chatplus", "late", "phonecal", "tglogin", "server"]) expect(by(k).text, k).not.toMatch(/ — /);
    expect(new Set(items.map((it) => it.key)).size).toBe(items.length);
  });
  it("новые экраны без эмодзи и без « — » в текстах для людей", async () => {
    for (const f of ["ui/server.jsx", "ui/cal-sheet.jsx", "lib/late.js", "lib/ical.js", "lib/tg-login.js", "lib/chat-mention.js", "lib/chat-search.js", "lib/chat-draft.js", "lib/server-check.js", "api/cal.js"])
      expect(rd(f), f).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    for (const f of ["ui/server.jsx", "ui/cal-sheet.jsx", "api/cal.js"]) {
      const code = rd(f).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\s\/\/ .*$/, "")).join("\n");
      const strings = [...code.matchAll(/"([^"\\\n]*(?:\\.[^"\\\n]*)*)"/g)].map((m) => m[1]).filter((s) => /[А-Яа-яЁё]/.test(s));
      expect(strings.length, f).toBeGreaterThan(5);
      for (const s of strings) expect(s, f).not.toMatch(/ — /);
    }
    const R = await import("../lib/server-check.js");
    for (const s of R.STAGES) expect(s.what).not.toMatch(/ — /);
  });
});

describe("v99: документы", () => {
  it("README: e2e-v99, test39, демо; supabase/README — этап 39 и tg-bot; CHANGES: Дополнение 412; «сборка v99»", () => {
    const readme = rd("tools/claude/README.md");
    expect(readme).toContain("`e2e-v99.mjs` — v99 (Доп. 412)");
    expect(readme).toContain("bash sql/test39.sh");
    expect(readme).toContain("«Анна: новый телефон»");
    const sr = rd("supabase/README.md");
    expect(sr).toContain("### Этап 39 (v99) — удобство каждый день");
    expect(sr).toContain("| 48 | `supabase-stage39-everyday.sql` |");
    expect(sr).toContain("2. **Обновить функцию `tg-bot`.**");
    expect(sr).toContain("3. **Подключить бота из приложения.** «Команда» → «Сервер» → «Подключить бота».");
    expect(rd("CHANGES.md")).toContain("# Дополнение 412 — Удобство каждый день: вход через Telegram, упоминания, поиск и черновики, «Опаздываю», смены в календаре телефона, экран «Сервер» (v99)");
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(99|\d{3,})<\/span>/);
  });
});
