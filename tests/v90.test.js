// v90 (Доп. 403): чат смены — «Вся команда», «Старшие» и личные; ответ с цитатой (свайп или «Ответить»), правка своего
// (сутки), реакции значками, закреп в группе, фото (сжатие на телефоне), «Позвать» и «Иду», бот; значок в верхней строке
// со счётчиком, баннер вызова поверх приложения. Сервер — этап 38 (tools/claude/sql/test38.sh), вид —
// tools/claude/e2e-v90.mjs, демо — tools/claude/chat-demo.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, existsSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const DASH = /[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g;
const NOW = new Date(2026, 9, 26, 19, 30);   // 26 октября, 19:30 (местное)
const at = (min) => new Date(NOW.getTime() - min * 60000).toISOString();

describe("v90: расчёт чата (lib/chat.js)", () => {
  it("подписи: инициалы, имя в пузыре, время, дни, время в списке", async () => {
    const C = await import("../lib/chat.js");
    expect([C.chatInitials("Анна Смирнова"), C.chatInitials("ольга"), C.chatInitials("")]).toEqual(["АС", "О", "?"]);
    expect([C.bubbleName("Мария Ким"), C.bubbleName("Илья"), C.bubbleName("")]).toEqual(["Мария К.", "Илья", ""]);
    expect(C.hhmm(new Date(2026, 9, 26, 9, 5))).toBe("09:05");
    expect([C.dayLabel(NOW, NOW), C.dayLabel(new Date(2026, 9, 25, 23), NOW), C.dayLabel(new Date(2026, 9, 3), NOW), C.dayLabel(new Date(2025, 11, 31), NOW)])
      .toEqual(["Сегодня", "Вчера", "3 октября", "31 декабря 2025"]);
    expect([C.listTime(new Date(2026, 9, 26, 8, 7), NOW), C.listTime(new Date(2026, 9, 25, 8), NOW), C.listTime(new Date(2026, 8, 2), NOW)]).toEqual(["08:07", "вчера", "02.09"]);
  });
  it("вызов: строка, «тебя», кому адресован, состояние, проверка перед отправкой", async () => {
    const C = await import("../lib/chat.js");
    const call = (c, emp = "p2", name = "Ольга Ли", min = 0) => ({ id: 1, kind: "call", emp, name, at: at(min), call: c });
    expect(C.callLine(call({ who: "host", why: "table", table: "5" }))).toBe("Ольга зовёт хостес: к столу 5");
    expect(C.callLine(call({ who: "person", emp: "me", toName: "Роман", why: "come" }), "me")).toBe("Ольга зовёт тебя: подойди ко мне");
    expect(C.callLine(call({ who: "lead", why: "own", text: " Принеси стульчик " }))).toBe("Ольга зовёт менеджера: Принеси стульчик");
    expect(C.callLine(call({ who: "person", emp: "p3", toName: "Анна Смирнова", why: "come" }), "me")).toBe("Ольга зовёт Анну: подойди ко мне");
    expect(C.callLine(call({ who: "person", emp: "p4", to_name: "Пётр Орлов", why: "table", table: "7" }), "me")).toBe("Ольга зовёт Петра: к столу 7");   // как присылает сервер
    expect(["Анна", "Мария", "Илья", "Ольга", "Роман", "Пётр", "Андрей", "Игорь", "Павел", "Любовь", "Саша", "Никита", "Нико", ""].map(C.accName))
      .toEqual(["Анну", "Марию", "Илью", "Ольгу", "Романа", "Петра", "Андрея", "Игоря", "Павла", "Любовь", "Сашу", "Никиту", "Нико", ""]);
    expect(C.isCallForMe(call({ who: "lead", why: "help" }), { id: "me", pos: "manager" })).toBe(true);
    expect(C.isCallForMe(call({ who: "bar", why: "help" }), { id: "me", pos: "waiter" })).toBe(false);
    expect(C.isCallForMe(call({ who: "waiter", why: "help" }, "me"), { id: "me", pos: "waiter" })).toBe(false);   // свой — не мне
    expect(C.callState(call({ who: "host", why: "help", going: [{ id: "p3", name: "Анна" }] }), NOW.getTime()).st).toBe("going");
    expect(C.callState(call({ who: "host", why: "help" }, "p2", "Ольга", 3), NOW.getTime())).toEqual({ st: "wait", min: 3 });
    expect(C.callState(call({ who: "host", why: "help" }, "p2", "Ольга", 12), NOW.getTime())).toEqual({ st: "stale", min: 12 });
    expect([C.callProblem({}), C.callProblem({ who: "host" }), C.callProblem({ who: "host", why: "table", table: "5!" }), C.callProblem({ who: "host", why: "own", text: " " }),
      C.callProblem({ who: "host", why: "own", text: "я".repeat(81) }), C.callProblem({ who: "person", emp: "p3", why: "come" })])
      .toEqual(["Выбери, кого позвать", "Выбери, зачем", "Укажи номер стола", "Напиши, зачем зовёшь", "Короче, до 80 знаков", ""]);
  });
  it("последнее в списке и цитата: фото, вызов, служебное, удалённое, своё", async () => {
    const C = await import("../lib/chat.js");
    expect(C.previewText({ emp: "p5", name: "Илья Белов", kind: "photo", body: "Карта коктейлей" }, "me")).toBe("Илья: Фото: Карта коктейлей");
    expect(C.previewText({ emp: "me", name: "Роман", kind: "photo", body: "" }, "me")).toBe("Ты: Фото");
    expect(C.previewText({ emp: "p1", name: "Мария Ким", kind: "text", body: "Привет\n  всем" }, "me", false)).toBe("Привет всем");
    expect(C.previewText({ kind: "sys", body: "Мария закрепляет «Банкет»" }, "me")).toBe("Мария закрепляет «Банкет»");
    expect(C.previewText({ del: true, body: "" }, "me")).toBe("Сообщение удалено");
    expect(C.previewText({ kind: "call", call: { who: "bar", why: "help" } }, "me")).toBe("Вызов: бар, нужна помощь");
    expect(C.quoteText({ kind: "photo", body: "" })).toBe("Фото");
    expect(C.quoteText({ kind: "text", body: "а".repeat(200) })).toBe("а".repeat(119) + "…");
    expect(C.quoteText({ kind: "call", body: "Анна зовёт менеджера: к столу 5" })).toBe("Анна зовёт менеджера: к столу 5");
    expect(C.quoteText({ del: true })).toBe("Сообщение удалено");
    expect(C.replyOf({ id: 9, emp: "p1", name: "Мария Ким", kind: "photo", body: "Зал", at: at(1) })).toEqual({ id: 9, emp: "p1", name: "Мария Ким", kind: "photo", body: "Зал", photo: true, del: false, call: undefined });
  });
  it("правка своего — сутки; закреп — группа (в «Вся команда» руководитель); закрепить можно текст и фото", async () => {
    const C = await import("../lib/chat.js");
    const m = (o) => ({ id: 1, emp: "me", kind: "text", body: "x", at: at(60), ...o });
    expect([C.canEdit(m(), "me", NOW.getTime()), C.canEdit(m({ emp: "p1" }), "me", NOW.getTime()), C.canEdit(m({ at: at(60 * 25) }), "me", NOW.getTime()),
      C.canEdit(m({ kind: "call" }), "me", NOW.getTime()), C.canEdit(m({ kind: "photo" }), "me", NOW.getTime()), C.canEdit(m({ del: true }), "me", NOW.getTime())])
      .toEqual([true, false, false, false, true, false]);
    expect(C.EDIT_HOURS).toBe(24);
    expect([C.canPin({ kind: "team" }, { lead: true }), C.canPin({ kind: "team" }, { lead: false }), C.canPin({ kind: "leads" }, { lead: false }), C.canPin({ kind: "dm" }, { lead: true }),
      C.canPin({ kind: "net" }, { lead: true })]).toEqual([true, false, true, false, true]);
    expect([C.canDelOthers({ kind: "team" }, { lead: true }), C.canDelOthers({ kind: "dm" }, { lead: true }), C.canDelOthers({ kind: "net" }, { lead: true, network: false }),
      C.canDelOthers({ kind: "net" }, { lead: true, network: true }), C.canDelOthers({ kind: "leads" }, { lead: false })]).toEqual([true, false, false, true, false]);
    expect([C.restShort("Два моря, Океан"), C.restShort("Порт"), C.restShort(""), C.restShort("А, Б, В")]).toEqual(["Океан", "Порт", "", "В"]);
    expect([C.pinnable({ kind: "text" }), C.pinnable({ kind: "photo" }), C.pinnable({ kind: "call" }), C.pinnable({ kind: "sys" }), C.pinnable({ kind: "text", del: true })])
      .toEqual([true, true, false, false, false]);
  });
  it("реакции: шесть видов значками, группы по числу, моя, у человека одна", async () => {
    const C = await import("../lib/chat.js");
    expect(C.REACTS.map((r) => r[0])).toEqual(["ok", "like", "heart", "lol", "wow", "fire"]);
    expect(C.REACTS.map((r) => r[1])).toEqual(["Принято", "Класс", "Сердце", "Смешно", "Ого", "Огонь"]);
    const rx = [{ r: "heart", emp: "p1", name: "Мария Ким" }, { r: "ok", emp: "p2", name: "Ольга Ли" }, { r: "ok", emp: "me", name: "Роман" }, { r: "смайлик", emp: "p3" }];
    expect(C.reactGroups(rx, "me")).toEqual([{ r: "ok", n: 2, mine: true, names: ["Ольга Ли", "Роман"] }, { r: "heart", n: 1, mine: false, names: ["Мария Ким"] }]);
    expect(C.myReact({ reacts: rx }, "me")).toBe("ok");
    const me = { id: "me", name: "Роман" };
    expect(C.withReact(rx, "fire", me).filter((x) => x.emp === "me")).toEqual([{ r: "fire", emp: "me", name: "Роман" }]);
    expect(C.withReact(rx, null, me).some((x) => x.emp === "me")).toBe(false);
    expect(C.reactName("wow")).toBe("Ого");
  });
  it("фото: сжатие до длинной стороны и место в пузыре", async () => {
    const C = await import("../lib/chat.js");
    expect([C.fitSize(4032, 3024, 1280), C.fitSize(800, 600, 1280), C.fitSize(1000, 3000, 360)]).toEqual([{ w: 1280, h: 960 }, { w: 800, h: 600 }, { w: 120, h: 360 }]);
    expect([C.photoBox(1280, 960), C.photoBox(960, 1280), C.photoBox(300, 3000), C.photoBox(0, 0)]).toEqual([{ w: 260, h: 195 }, { w: 240, h: 320 }, { w: 120, h: 320 }, { w: 260, h: 195 }]);
  });
  it("лента: дни, столбики подряд, вызовы и служебные — посередине; кто прочитал; счётчики", async () => {
    const C = await import("../lib/chat.js");
    const msgs = [{ id: 1, emp: "p1", name: "Мария Ким", at: at(60 * 26) }, { id: 2, emp: "p1", name: "Мария Ким", at: at(30) }, { id: 3, emp: "p1", name: "Мария Ким", at: at(29) },
      { id: 4, kind: "sys", emp: "p1", body: "Мария закрепляет «…»", at: at(28) }, { id: 5, emp: "me", name: "Роман", at: at(10) }, { id: 6, kind: "call", emp: "p2", at: at(5), call: { who: "host", why: "help" } }];
    const rows = C.feedRows(msgs, "me", true, NOW);
    expect(rows.map((r) => (r.type === "day" ? r.label : r.m.id + ":" + r.side + (r.same ? "s" : "") + (r.cont ? "c" : "") + (r.showName ? "n" : ""))))
      .toEqual(["Вчера", "1:inn", "Сегодня", "2:incn", "3:ins", "4:mid", "5:out", "6:mid"]);
    expect(C.readBy({ id: 5 }, { me: 9, p1: 5, p2: 4, p3: 7 }, "me")).toEqual(["p1", "p3"]);
    expect([C.unreadTotal([{ unread: 2 }, { unread: 0 }, {}, { unread: "3" }]), C.badge(0), C.badge(7), C.badge(120)]).toEqual([5, "", "7", "99+"]);
    expect([C.peopleWord(1), C.peopleWord(3), C.peopleWord(12), C.peopleWord(22)]).toEqual(["1 человек", "3 человека", "12 человек", "22 человека"]);
    expect([C.readLine(3, 7), C.readLine(0, 0), C.readLine(1, 1, false), C.readLine(0, 1, false)]).toEqual(["прочитали 3 из 7", "", "прочитано", ""]);
    expect(C.cleanBody("  а\r\n\n\n\nб  ")).toBe("а\n\nб");
    expect(C.cleanBody("я".repeat(1200)).length).toBe(1000);
  });
});

describe("v90: сеть чата (lib/chat-api.js) и сжатие фото (lib/chat-photo.js)", () => {
  it("каждый вызов — своя функция этапа 38 с токеном; фото — готовой ссылкой data:", async () => {
    const { chatApi } = await import("../lib/chat-api.js");
    const log = [];
    const api = chatApi((fn, args) => { log.push([fn, args]); return Promise.resolve(fn === "chat_photo" ? { ok: true, data: "AAAA", mime: "image/jpeg", w: 8, h: 6 } : { ok: true }); });
    await api.list(); await api.open(5, { after: 10, since: "2026-10-26T07:00:00Z" }); await api.send(5, "Привет", 3); await api.read(5, 12);
    await api.dm(77); await api.people(); await api.call({ who: "host", why: "table", table: "5" }); await api.go(9); await api.del(9);
    await api.edit(9, "текст"); await api.react(9, "ok"); await api.react(9, null); await api.pin(5, 9); await api.pin(5, null);
    await api.photoSend(5, { full: "F", thumb: "T", w: 16, h: 12, body: "подпись", reply: 4 });
    const ph = await api.photo(11, true);
    expect(log.map((x) => x[0])).toEqual(["chat_list", "chat_open", "chat_send", "chat_read", "chat_dm", "chat_people", "chat_call", "chat_go", "chat_delete", "chat_edit", "chat_react",
      "chat_react", "chat_pin", "chat_pin", "chat_photo_send", "chat_photo"]);
    expect(log[1][1]).toEqual({ p_chat: 5, p_after: 10, p_before: 0, p_since: "2026-10-26T07:00:00Z" });
    expect(log[2][1]).toEqual({ p_chat: 5, p_body: "Привет", p_reply: 3 });
    expect(log[4][1]).toEqual({ p_emp: "77" });
    expect(log[6][1]).toEqual({ p_who: "host", p_emp: null, p_why: "table", p_table: "5", p_text: null });
    expect([log[11][1], log[13][1]]).toEqual([{ p_msg: 9, p_r: null }, { p_chat: 5, p_msg: null }]);
    expect(log[14][1]).toEqual({ p_chat: 5, p_full: "F", p_thumb: "T", p_w: 16, p_h: 12, p_body: "подпись", p_reply: 4 });
    expect(log[15][1]).toEqual({ p_id: 11, p_full: true });
    expect(ph).toEqual({ ok: true, url: "data:image/jpeg;base64,AAAA", w: 8, h: 6 });
  });
  it("без этапа 38 — error: missing; токен — из входа; распознавание речи — функция stt", async () => {
    const src = rd("lib/chat-api.js");
    expect(src).toContain('.then((r) => (rpcMissing(r) ? { ok: false, error: "missing" }');
    expect(src).toContain("rpc(fn, { p_token: saToken(), ...args })");
    expect(src).toContain('export const chatStt = () => ({ url: SUPABASE_URL + "/functions/v1/stt"');
  });
  it("сжатие: 1280 точек, превью 360, пределы 300 и 48 КБ; не картинка — ошибка type", async () => {
    const P = await import("../lib/chat-photo.js");
    expect([P.PHOTO_SIDE, P.THUMB_SIDE, P.PHOTO_MAX_BYTES, P.THUMB_MAX_BYTES]).toEqual([1280, 360, 300 * 1024, 48 * 1024]);
    await expect(P.compressPhoto({ type: "text/plain" })).rejects.toThrow("type");
    await expect(P.compressPhoto(null)).rejects.toThrow("type");
    const src = rd("lib/chat-photo.js");
    expect(src).toContain('createImageBitmap(file, { imageOrientation: "from-image" })');
    expect(src).toContain('canvas.toBlob((b) => res(b), "image/jpeg", q)');
  });
});

describe("v90: экран чата (ui/chat.jsx)", () => {
  it("вид: свайп — только пальцем (мышью выделяют текст), строки ленты пропускают движение вбок, фото на весь экран — без жестов браузера", () => {
    const src = rd("ui/chat.jsx");
    expect(src).toContain('const down = (e) => { if (!on || e.pointerType === "mouse") return;');
    expect(src).toContain(".ch-row{position:relative;display:flex;flex-direction:column;margin-top:9px;touch-action:pan-y}");
    expect(src).toContain(".ch-view,.ch-view *{touch-action:none !important}");
    expect(src).toContain("const SWIPE_AT = 56;");
    expect(src).toContain("return portal(");   // поверх приложения — в body (кнопка «Назад» Telegram закрывает сначала чат)
  });
  it("реакции — значками линией для всех шести видов; эмодзи и «слово — слово» в коде нет", async () => {
    const src = rd("ui/chat-kit.jsx");   // v93: значки и реакции переехали в ui/chat-kit.jsx (общие с умными карточками)
    const { REACTS } = await import("../lib/chat.js");
    for (const [r] of REACTS) expect([r, new RegExp("\\n  " + r + ": <").test(src)]).toEqual([r, true]);
    for (const f of ["ui/chat.jsx", "ui/chat-kit.jsx", "lib/chat.js", "lib/chat-api.js", "lib/chat-photo.js"]) {
      expect([f, /\p{Extended_Pictographic}/u.test(code(rd(f)))]).toEqual([f, false]);
      expect([f, code(rd(f)).match(DASH)]).toEqual([f, null]);
    }
  });
  it("лист сообщения: реакции, «Ответить», «Изменить», «Закрепить для всех», «Скопировать», «Удалить»; правка и ответ — над строкой ввода", () => {
    const src = rd("ui/chat.jsx");
    for (const a of ["data-chat-react={r}", "data-chat-reply=\"\"", "data-chat-edit=\"\"", "data-chat-pin={isPinned ? \"off\" : \"on\"}", "data-chat-copy=\"\"", "data-chat-del=\"\"",
      "data-chat-replybar={reply.id}", "data-chat-editbar={edit.id}", "data-chat-pinbar={pin.id}", "data-chat-attach=\"\"", "data-chat-photosheet=\"\"", "data-chat-viewer={id}"]) expect([a, src.includes(a)]).toEqual([a, true]);
    expect(src).toContain('{canPin(chat, me) && pinnable(msg) ? <button type="button" className="ch-act" data-chat-pin=');
    expect(src).toContain("const canDel = mine || canDelOthers(chat, me);");   // в личной чужое не удалить; в сети — руководящий состав
  });
  it("баннер вызова: «Ольга зовёт тебя: к столу 5» и «Иду»", async () => {
    const { CallBanner } = await import("../ui/chat.jsx");
    const html = R(h(CallBanner, { a11y: false, me: { id: "me" }, call: { id: 7, emp: "p2", name: "Ольга Ли", kind: "call", call: { who: "person", emp: "me", toName: "Роман", why: "table", table: "5" } }, onGo: () => {}, onClose: () => {} }));
    expect(html).toContain("Ольга зовёт тебя: к столу 5");
    expect(html).toMatch(/<button type="button" class="ch-go" data-chat-banner-go=""[^>]*>Иду<\/button>/);
  });
});

describe("v90: чат в приложении", () => {
  const app = rd("App.jsx");
  it("значок чата с числом непрочитанных (v91: круг у нижнего меню вместо верхней строки — tests/v91.test.js); нет в тесте, на экзамене и в собеседовании", () => {
    expect(app).not.toContain("data-top-chat=");
    expect(app).toContain('const chatDockProps = profile && profile.restaurant && chatOn ? { n: chatUnread, label: chatBadge(chatUnread), onOpen: () => openChat(null) } : null;');
    expect((app.match(/chat=\{chatDockProps\}/g) || []).length).toBe(2);   // нижнее меню и меню слева: их нет в тесте, на экзамене, у кандидата
    expect(app).toContain('const NAV_SCREENS = ["roleSelect","home","module","leaderboard","glossary","stats","daily","playerDetail","team","shift","teamHub","me"];');
  });
  it("непрочитанные и вызовы — chat_unread раз в 20 секунд на виду; без этапа 38 значка нет", async () => {
    const { POLL_APP_MS } = await import("../lib/chat.js");
    expect(POLL_APP_MS).toBe(20000);
    expect(app).toContain('rpc("chat_unread", { p_token: saToken() }).then((r) => {\n      if (rpcMissing(r)) { st.off = true; setChatOn(false); return; }');
    expect(app).toContain("const t = setInterval(() => { if (!chatOpenRef.current && (typeof document === \"undefined\" || !document.hidden)) loadChatInfo(false); }, POLL_APP_MS);");
    expect(app).toContain("const first = setTimeout(() => loadChatInfo(true), 4000);");   // старт остаётся одним запросом (v64)
  });
  it("чат — слой поверх всего (как Наставник), баннер вызова, пока чат закрыт; ссылка бота ?go=chat; пункт в «Смене»; справка", async () => {
    const { TOP_KINDS, layersReducer } = await import("../lib/layers.js");
    expect(TOP_KINDS.has("chat")).toBe(true);
    const s = layersReducer(layersReducer([], { type: "open", kind: "special", data: { key: 1 } }), { type: "open", kind: "chat", data: true });
    expect(s.map((l) => l.kind)).toEqual(["special", "chat"]);   // под чатом не теряется то, что было открыто
    expect(app).toContain("const myCall = chatOn && chatOpen == null && chatInfo ?");
    expect(app).toContain('{chatOpen != null && chatMe ? <Suspense fallback={null}><ChatScreen a11y={a11y} me={chatMe} api={chatApiObj} stt={chatStt}');
    expect(app).toContain('"thanks", "seat", "chat"].includes(v) ? v : "";');
    expect(app).toContain('else if (g === "chat") setChatOpen(true);');
    expect(app).toContain('chatOn && profile.restaurant && { key:"chat", group:"На смене", icon:"chat", label:"Чат смены"');
    expect(app).toContain('else if (dest === "chat") openChat(null);   // v90');
    const { GUIDE } = await import("../ui/guide.jsx");
    const g = GUIDE.flatMap((x) => x.items || []).find((x) => x.key === "chat") || {};
    expect(g.go).toBe("chat");
    expect(g.text).toContain("Круг с облачками рядом с нижним меню");   // v91: был «в верхней строке, рядом с лупой»
    expect(g.text).toContain("Ответить с цитатой: свайп по сообщению вбок");
    expect(g.text.match(DASH)).toBe(null);
  });
  it("«Напоминания в Telegram»: вид «Чат смены» первым в «Смене», если сервер его знает (этап 38)", async () => {
    const { prefRows, prefGroups } = await import("../ui/day-cards.jsx");
    const base = { ok: true, pair: true, quest: true, league: true, fresh: true, month: true };
    expect(prefRows(base).map((r) => r[0])).not.toContain("chat");
    const row = prefRows({ ...base, chat: false }).find((r) => r[0] === "chat");
    expect(row).toEqual(["chat", "Чат смены", "личные сообщения, ответы тебе и вызовы, когда тебя нет в чате"]);
    expect(prefGroups({ ...base, chat: true, brief: true }).find((g) => g[0] === "shift")[2].map((r) => r[0])).toEqual(["chat", "quest", "brief"]);
  });
});

describe("v90: этап 38 на сервере (статично; живые проверки — tools/claude/sql/test38.sh)", () => {
  const sql = rd("supabase/supabase-stage38-chat.sql");
  it("31 функция (v91: + chat_clear; v92: + свои чаты; v93: + умный чат) — anon, служебные — нет; таблицы закрыты", () => {
    const fns = ["chat_list(text)", "chat_unread(text)", "chat_open(text, bigint, bigint, bigint, timestamptz)", "chat_read(text, bigint, bigint)", "chat_send(text, bigint, text, bigint)",
      "chat_photo_send(text, bigint, text, text, int, int, text, bigint)", "chat_photo(text, bigint, boolean)", "chat_edit(text, bigint, text)", "chat_react(text, bigint, text)",
      "chat_pin(text, bigint, bigint)", "chat_dm(text, text)", "chat_people(text)", "chat_call(text, text, text, text, text, text)", "chat_go(text, bigint)", "chat_delete(text, bigint)",
      "chat_clear(text, bigint)", "chat_group_create(text, text, text[])", "chat_group_edit(text, bigint, text, text[], text[])", "chat_group_leave(text, bigint)", "chat_group_delete(text, bigint)",
      "chat_shift_mine(text)", "chat_shift_offer(text, bigint, text, text, text[], text)", "chat_shift_take(text, bigint)", "chat_shift_options(text, bigint)", "chat_shift_swap(text, bigint, text)",
      "chat_shift_cancel(text, bigint)", "chat_card_send(text, bigint, jsonb)", "chat_task_remind(text, bigint)", "chat_poll_vote(text, bigint, int)", "chat_stop_set(text, bigint, text, boolean, bigint)",
      "chat_ai_post(text, bigint, bigint, text, jsonb)"];   // v93
    for (const f of fns) expect([f, sql.includes("grant execute on function " + f + " to anon, authenticated;")]).toEqual([f, true]);
    expect((sql.match(/^grant execute on function /gm) || []).length).toBe(31);
    expect((sql.match(/^revoke all on function _sa_chat/gm) || []).length).toBe(41);   // v92: + _sa_chat_title, _pick, _added, _group_out; v93: + 16 умного чата
    expect((sql.match(/^revoke all on function _sa_sh_/gm) || []).length).toBe(14);    // v93: смены по графику
    expect(sql).toContain("revoke all on table sa_chats, sa_chat_msgs, sa_chat_reads, sa_chat_reacts, sa_chat_photos from public, anon, authenticated;");
    expect(sql).toContain("' функций из 31 · таблицы: '");   // v93
  });
  it("правила: сутки на правку, реакции шести видов, закреп в группе, фото до 450 КБ, 10 за 10 минут, 60 в день и 200 МБ, 30 дней хранения (закреп — остаётся)", () => {
    expect(sql).toContain("if m.created_at < now() - interval '24 hours' then return jsonb_build_object('ok', false, 'error', 'too_late'); end if;");
    expect(sql).toContain("r text not null check (r in ('ok', 'like', 'heart', 'lol', 'wow', 'fire')),");
    expect(sql).toContain("if ch.kind in ('team', 'group') and not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");   // v92: и в своём чате
    expect(sql).toContain("if octet_length(full_b) > 450 * 1024 or octet_length(thumb_b) > 80 * 1024 then return jsonb_build_object('ok', false, 'error', 'too_big'); end if;");
    expect(sql).toContain("x.created_at > now() - interval '10 minutes') >= 10 then");
    expect(sql).toContain("(now() at time zone tz)::date) >= 60");
    expect(sql).toContain("> 200 * 1024 * 1024 then");
    expect(sql).toContain("x.created_at < now() - interval '30 days' and x.id is distinct from y.pin_id;");
    expect(sql).toContain("' отвечает тебе в «' || case ch.kind when 'team' then 'Вся команда' when 'leads' then 'Старшие'\n        when 'group' then coalesce(ch.title, 'Чат') else 'Руководители сети' end || '»:'");   // v92: свой чат — по названию
    // «Руководители сети»: любой руководитель, заведений два и больше; чужое удаляет руководящий состав
    expect(sql).toContain("(ch.kind = 'net' and coalesce((c->>'lead')::boolean, false) and coalesce(c->>'restaurant', '') <> '')");
    expect(sql).toContain("where (x.restaurant = rest or (x.kind = 'net' and multi)) and _sa_chat_ok(c, x)");
    expect(sql).toContain("or (coalesce((c->>'network')::boolean, false) and ch.kind = 'net')) then");
    expect(sql).toContain("' закрепляет «' || _sa_chat_cut(what, 48) || '»', 'sys', m.id)");
    expect(sql).toContain("Сначала этап 36 (supabase-stage36-comfort.sql): нужны тихие часы — notify_quiet");
  });
});

describe("v90: демо, справка и выпуск", () => {
  it("демо чата: настоящий ui/chat.jsx на сервере в памяти, главная — снимок со значком", async () => {
    for (const f of ["entry.jsx", "demo-api.js", "build.mjs", "shell.html", "mic-stub.jsx", "home-dark.webp", "home-light.webp"]) expect([f, existsSync("tools/claude/chat-demo/" + f)]).toEqual([f, true]);
    const { demoApi } = await import("../tools/claude/chat-demo/demo-api.js");
    const api = demoApi();
    const l = await api.list();
    expect(l.chats.map((c) => c.kind)).toEqual(["team", "leads", "net", "dm", "dm"]);
    const n = await api.open("net");
    expect([n.pin.name, n.msgs.find((m) => m.emp === "n1").rest, n.members.length]).toEqual(["Сергей Литвинов", "Два моря, Порт", 5]);
    const t = await api.open("team");
    expect(t.pin.body).toContain("Доброе утро! Сегодня банкет");
    expect(t.msgs.some((m) => m.kind === "photo" && m.photo && m.photo.id === "d1")).toBe(true);
    const s = await api.send("team", "Проверка", t.pin.id);
    expect(s.msg.reply.id).toBe(t.pin.id);
    expect((await api.react(s.msg.id, "ok")).msg.reacts).toEqual([{ r: "ok", emp: "me", name: "Роман" }]);
    expect((await api.edit(s.msg.id, "Проверка связи")).msg.edited).toBe(true);
    const p = await api.pin("team", s.msg.id);
    expect([p.pin.id, p.msg.kind, p.msg.body]).toEqual([s.msg.id, "sys", "Роман закрепляет «Проверка связи»"]);
    expect((await api.pin("dm-p3", s.msg.id)).error).toBe("not_found");
  });
  it("README: e2e-v90, test38, демо; CHANGES: Дополнение 403; «сборка v90»", () => {
    const readme = rd("tools/claude/README.md");
    for (const s of ["`e2e-v90.mjs` — v90 (Доп. 403), чат смены", "bash sql/test38.sh", "node tools/claude/chat-demo/build.mjs"]) expect([s, readme.includes(s)]).toEqual([s, true]);
    expect(rd("CHANGES.md")).toContain("# Дополнение 403 — Чат смены (v90)");
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(9\d|\d{3,})<\/span>/);
  });
});
