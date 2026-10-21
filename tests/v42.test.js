// v42 (Доп. 355): «Живой гость» знает роль.
//
// Отзыв владельца: «Прохожу роль хостес, а гость спрашивает меня как официанта: начинает со встречи, а потом
// говорит, что я не предложил аперитив, и засчитывает это за ошибку». Причина была на сервере: подсказка гостя
// для всех ролей вела визит по шагам официанта (встреча → заказ → подача → счёт), а чек разбора оценивал
// «знание меню» и «рекомендации». Теперь место гостя — по треку (хостес — вход, бар — стойка, менеджер —
// гость, который позвал менеджера), подсказка гостя и чек разбора — по роли, уроки на повтор — из её трека.
// Ниже — и логика приложения, и настоящие подсказки ai-chat (функции из supabase/functions/ai-chat/index.ts).
// Вид в браузере — /home/claude/preview/e2e-v42.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };
import { placeOf, pickGuest, PERSONAS, placeUi, guestSub, parseReceipt, CRITERIA, CRITERIA_BY_PLACE, criteriaOf, guestErrorText, receiptKind, NEW_IN_V42 } from "../lib/live-guest";

let aiMod = null;
async function loadAi() {
  if (aiMod) return aiMod;
  // функция Supabase написана для Deno: на время проверки — заглушка (Deno.serve вызывается при загрузке)
  if (!globalThis.Deno) globalThis.Deno = { serve() {}, env: { get: () => undefined } };
  aiMod = await import("../supabase/functions/ai-chat/index.ts");
  return aiMod;
}
const ids = (s) => [...String(s).matchAll(/\[([a-z0-9-]+)\]/g)].map((m) => m[1]);
const mapPart = (s) => String(s).slice(String(s).indexOf("КАРТА УРОКОВ:"));
const jsonKeys = (s) => { const m = String(s).match(/"scores": \{([^}]*)\}/); return m ? [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]) : []; };

describe("место гостя — по треку, который человек проходит", () => {
  it("хостес, бар, менеджер и сервис-менеджер — по треку, какая бы ни была должность", () => {
    expect([placeOf("spg", "waiter"), placeOf("spg", "bartender"), placeOf("bar", "hostess"), placeOf("manager", "waiter"), placeOf("service_manager", "senior")])
      .toEqual(["door", "door", "bar", "manager", "manager"]);
  });
  it("общие треки — зал, но хостес и бармена по должности встречает их гость (как с v30); трека нет — по должности", () => {
    expect([placeOf("seasonal", "waiter"), placeOf("core", "manager"), placeOf("core", "senior_bartender"), placeOf("seasonal", "hostess")]).toEqual(["hall", "hall", "bar", "door"]);
    expect([placeOf(null, "hostess"), placeOf(null, "manager"), placeOf(null, "senior"), placeOf(null, "waiter"), placeOf("", "")]).toEqual(["door", "manager", "manager", "hall", "hall"]);
  });
  it("хостес выпадают только гости у входа — их теперь шесть, с бронью по телефону и проводами", () => {
    const got = new Set(); for (let i = 0; i < 80; i++) got.add(pickGuest({ role: "spg", position: "waiter", seed: i }).id);
    expect([...got].sort()).toEqual(["booked", "family", "leaving", "nobook", "phone", "vip"]);
    const g = pickGuest({ role: "spg", seed: 4 });
    expect([g.place, g.table]).toEqual(["door", 0]);
  });
  it("менеджеру — гость, который позвал менеджера: за столом, с номером стола", () => {
    const got = new Set(); for (let i = 0; i < 60; i++) got.add(pickGuest({ role: "manager", position: "manager", seed: i }).id);
    expect([...got].sort()).toEqual(["banquet", "bill", "refuse", "review", "steak"]);
    const g = pickGuest({ role: "service_manager", seed: 2 });
    expect(g.place).toBe("manager");
    expect(g.table).toBeGreaterThanOrEqual(2);
    expect(g.line).toMatch(/^стол \d+ · /);
  });
  it("официанту и бармену — как раньше", () => {
    const hall = new Set(), bar = new Set();
    for (let i = 0; i < 60; i++) { hall.add(pickGuest({ role: "seasonal", position: "waiter", seed: i }).place); bar.add(pickGuest({ role: "bar", seed: i }).place); }
    expect([[...hall], [...bar]]).toEqual([["hall"], ["bar"]]);
    expect(PERSONAS.hall.map((p) => p.id)).toEqual(["rush", "allergy", "party", "late", "doubt", "regular", "kid", "complain"]);
  });
  it("руководитель на треке менеджера может сыграть своего гостя зала — в роли официанта; бармену гость зала не выпадает", () => {
    const own = [{ id: "c-abc123abc123", place: "hall", name: "Пётр", open: "Добрый день!" }, { id: "c-door00000001", place: "door", name: "Нина", open: "Здравствуйте" }];
    const a = pickGuest({ role: "manager", position: "manager", seed: 1, extra: own, prefer: "c-abc123abc123" });
    expect([a.id, a.place, placeUi(a).finish]).toEqual(["c-abc123abc123", "hall", "Рассчитать гостя"]);
    expect(pickGuest({ role: "manager", seed: 1, extra: own, prefer: "c-door00000001" }).place).toBe("manager");
    expect(pickGuest({ role: "bar", seed: 1, extra: own, prefer: "c-abc123abc123" }).id).not.toBe("c-abc123abc123");
    // свои гости менеджеру в случайный выбор не попадают — у сервера нет для них места «менеджер»
    const got = new Set(); for (let i = 0; i < 40; i++) got.add(pickGuest({ role: "manager", seed: i, extra: own }).id);
    expect([...got].some((x) => /^c-/.test(x))).toBe(false);
  });
});

describe("сервер ai-chat ещё старый (до v42)", () => {
  it("новых гостей знает только обновлённый ai-chat — после bad_guest гости как в v41: без новых, менеджеру — гости зала", () => {
    const fresh = Object.values(PERSONAS).flat().map((p) => p.id).filter((id) => NEW_IN_V42.has(id)).sort();
    expect(fresh).toEqual(["banquet", "bill", "family", "leaving", "phone", "refuse", "review", "steak"]);
    const door = new Set(), mgr = new Set();
    for (let i = 0; i < 60; i++) { door.add(pickGuest({ role: "spg", seed: i, legacy: true }).id); mgr.add(pickGuest({ role: "manager", position: "manager", seed: i, legacy: true }).place); }
    expect([...door].sort()).toEqual(["booked", "nobook", "vip"]);
    expect([...mgr]).toEqual(["hall"]);
    // свои гости зала у менеджера в режиме v41 снова выпадают — как раньше
    const own = [{ id: "c-abc123abc123", place: "hall", name: "Пётр", open: "Добрый день!" }];
    const got = new Set(); for (let i = 0; i < 40; i++) got.add(pickGuest({ role: "manager", seed: i, extra: own, legacy: true }).id);
    expect(got.has("c-abc123abc123")).toBe(true);
  });
  it("экран: после bad_guest — «Другой гость» и режим v41 до конца сеанса; ответ без метки версии — подсказка обновить ai-chat", async () => {
    const src = readFileSync("ui/live-guest.jsx", "utf8");
    expect(src).toMatch('if (code !== "bad_guest" || guest.custom || !NEW_IN_V42.has(guest.id)) return;');
    expect(src).toMatch('sessionStorage.setItem("sa_guest_legacy", "1")');
    expect(src).toMatch('{err === "bad_guest" ? <button type="button" className="tb-ghost" data-guest-other="" onClick={anotherAfterErr}>Другой гость</button> : null}');
    expect(src).toMatch("if (j.done) setOldAi(!(Number(j.v) >= 42));");
    expect(src).toMatch("if (d && d.ok) setOldAi(!(Number(d.v) >= 42));");
    expect(src).toMatch("ИИ-гость на сервере ещё прежней версии — может вести себя как с официантом. Руководителю: обновить функцию ai-chat.");
    const ai = await loadAi();
    expect(ai.AI_CHAT_V).toBeGreaterThanOrEqual(42);   // v67 — 67; приложение сравнивает «не меньше 42»
    const chat = readFileSync("supabase/functions/ai-chat/index.ts", "utf8");
    expect(chat).toMatch("send({ done: true, model, remaining, v: AI_CHAT_V })");
    expect(chat).toMatch("return json({ ok: true, reply, model: data?.model || m, remaining, v: AI_CHAT_V })");
  });
});

describe("слова экрана по роли", () => {
  it("хостес: кто ты в сцене, «Встретить гостя», «Завершить встречу» — без «Рассчитать гостя»", () => {
    const u = placeUi({ place: "door" });
    expect(u.role).toMatch(/^Ты — хостес: встреча, бронь, рассадка и передача официанту\. Заказ и аперитив — уже работа официанта\.$/);
    expect([u.eye, u.go, u.finish, u.ended]).toEqual(["ВХОД", "Встретить гостя", "Завершить встречу", "Встреча у входа окончена"]);
  });
  it("звонок на стойку хостес — своя карточка и кнопки", () => {
    const g = pickGuest({ role: "spg", seed: 1, prefer: "phone" });
    const u = placeUi(g);
    expect([g.phone, g.line, u.eye, u.go, u.finish, u.ended]).toEqual([true, "стойка хостес · звонок · бронь", "ЗВОНОК НА СТОЙКУ", "Ответить на звонок", "Завершить звонок", "Звонок окончен"]);
  });
  it("менеджер: стол, «Подойти к гостю», «Завершить разговор»; официант и бармен — как до v42", () => {
    const m = placeUi({ place: "manager", table: 7 });
    expect([m.eye, m.where, m.go, m.finish]).toEqual(["СТОЛ 7", "стол 7", "Подойти к гостю", "Завершить разговор"]);
    const h = placeUi({ place: "hall", table: 4 });
    expect([h.eye, h.go, h.finish, h.ended]).toEqual(["СТОЛ 4", "Подойти к столу", "Рассчитать гостя", "Гость попросил счёт — разговор окончен"]);
    const b = placeUi({ place: "bar" });
    expect([b.eye, b.where, b.go, b.finish]).toEqual(["БАРНАЯ СТОЙКА", "бар", "Подойти к гостю", "Рассчитать гостя"]);
  });
  it("проводы на выходе — «ВЫХОД», «Подойти к гостю», «Проводить гостя»", () => {
    const g = pickGuest({ role: "spg", seed: 1, prefer: "leaving" });
    const u = placeUi(g);
    expect([g.exit, u.eye, u.go, u.finish, u.ended]).toEqual([true, "ВЫХОД", "Подойти к гостю", "Проводить гостя", "Гость ушёл — проводы окончены"]);
    expect(u.role).toMatch(/^Ты — хостес: гость уходит после ужина\. Проводи/);
    // признаки звонка и проводов действуют только у входа
    expect(placeUi({ place: "hall", table: 3, phone: true, exit: true }).eye).toBe("СТОЛ 3");
  });
  it("подпись плитки на «Смене» — по роли", () => {
    expect(guestSub("seasonal", "waiter")).toBe("Разговор с гостем-ИИ из твоего меню · чек разбора");
    expect(guestSub("spg")).toBe("Гость-ИИ у входа: встреча, бронь, рассадка · чек разбора");
    expect(guestSub("bar")).toBe("Гость-ИИ у барной стойки · чек разбора");
    expect(guestSub("manager")).toBe("Гость-ИИ позвал менеджера · чек разбора");
  });
  it("сервер не знает нового гостя (ai-chat не обновлён) — понятное объяснение", () => {
    expect(guestErrorText("bad_guest")).toMatch(/нужно обновить ai-chat на сервере/);
  });
});

describe("чек разбора по роли", () => {
  it("у хостес — встреча, бронь и ожидание, рассадка и передача; ни меню, ни рекомендаций", () => {
    const r = parseReceipt('{"score": 4, "scores": {"contact": 5, "book": 4, "care": 3, "seat": 5, "calm": 4}, "good": ["Тёплая встреча"], "fix": [], "lessons": []}', () => true, "door");
    expect(r.crit.map((c) => c[1])).toEqual(["Встреча", "Бронь и ожидание", "Забота о госте", "Рассадка и передача", "Спокойствие"]);
    expect([r.scores, r.avg]).toEqual([{ contact: 5, book: 4, care: 3, seat: 5, calm: 4 }, 4.2]);
  });
  it("звонок на стойку хостес — свои подписи пунктов при тех же ключах", () => {
    expect(receiptKind({ place: "door", phone: true })).toBe("phone");
    expect([receiptKind({ place: "door" }), receiptKind({ place: "hall", phone: true }), receiptKind(null)]).toEqual(["door", "hall", "hall"]);
    const r = parseReceipt('{"score": 4, "scores": {"contact": 5, "book": 3, "care": 4, "seat": 4, "calm": 5}}', () => true, "phone");
    expect(r.crit.map((c) => c[1])).toEqual(["Начало звонка", "Бронь", "Забота о госте", "Стол и время", "Спокойствие"]);
    expect(r.crit.map((c) => c[0])).toEqual(CRITERIA_BY_PLACE.door.map((c) => c[0]));
  });
  it("у менеджера — разбор ситуации и решение; у бармена — знание бара", () => {
    expect(criteriaOf("manager").map((c) => c[0])).toEqual(["contact", "listen", "care", "solve", "calm"]);
    expect(criteriaOf("bar").map((c) => c[1])).toEqual(["Контакт у стойки", "Знание бара", "Забота и мера", "Рекомендации", "Спокойствие"]);
    expect(criteriaOf("нет такого")).toBe(CRITERIA);
  });
  it("официант — как до v42 (ключи и подписи те же)", () => {
    const r = parseReceipt('{"score": 7, "scores": {"contact": 5, "menu": 0, "care": "4"}}', () => true);
    expect(r.scores).toEqual({ contact: 5, menu: 3, care: 4, sales: 3, calm: 3 });
    expect(r.crit).toBe(CRITERIA);
    expect(CRITERIA_BY_PLACE.hall.map((c) => c[1])).toEqual(["Контакт и встреча", "Знание меню", "Забота о госте", "Рекомендации", "Спокойствие"]);
  });
  it("старый сервер (до v42) прислал пункты официанта — показываем их с подписями официанта, а не пустые звёзды", () => {
    const r = parseReceipt('{"score": 3, "scores": {"contact": 4, "menu": 2, "care": 3, "sales": 2, "calm": 4}}', () => true, "door");
    expect(r.crit).toBe(CRITERIA);
    expect(r.scores).toEqual({ contact: 4, menu: 2, care: 3, sales: 2, calm: 4 });
    // пустые оценки — не повод менять подписи
    expect(parseReceipt('{"score": 3, "scores": {}}', () => true, "door").crit).toBe(CRITERIA_BY_PLACE.door);
    // и у бармена, менеджера, звонка — так же
    const old = '{"score": 3, "scores": {"contact": 4, "menu": 2, "care": 3, "sales": 2, "calm": 4}}';
    expect(["bar", "manager", "phone"].map((k) => parseReceipt(old, () => true, k).crit === CRITERIA)).toEqual([true, true, true]);
  });
});

describe("сервер ai-chat: подсказки гостя и чека по роли", () => {
  it("все гости приложения есть на сервере, на том же месте", async () => {
    const ai = await loadAi();
    Object.entries(PERSONAS).forEach(([place, list]) => list.forEach((p) => {
      expect([p.id, (ai.GUEST_PERSONAS[p.id] || {}).place]).toEqual([p.id, place]);
      expect(ai.trustedGuest({ id: p.id, table: 5 }).table).toBe(place === "hall" || place === "manager" ? 5 : 0);
    }));
  });
  it("хостес: гость у входа не делает заказ, не ждёт аперитива; меню в карточке нет", async () => {
    const ai = await loadAi();
    for (const id of ["nobook", "booked", "vip", "family"]) {
      const s = ai.buildGuestSystem({ restaurant: "Порт" }, ai.trustedGuest({ id, menu: ["Борщ", "Стейк"], stop: ["Тирамису"] }));
      expect(s).toMatch("Тебя встречает хостес — живой человек, он тренируется именно в этой роли.");
      expect(s).toMatch("Где: стойка хостес у входа.");
      expect(s).toMatch("не делай хостес заказ, не жди от хостес аперитива, рекомендаций блюд и расчёта");
      expect(s).toMatch("Если хостес сама советует блюда или предлагает сделать заказ — не заказывай и не объясняй, чья это работа: скажи, что сначала хотелось бы сесть и спокойно посмотреть меню.");
      expect(s).toMatch("На «пойдёмте, я провожу» ещё не прощайся — иди следом.");
      expect(s).toMatch("не прощайся раньше второй реплики сотрудника. Заказ и счёт у хостес не проси.");
      expect(s).not.toMatch("Меню ресторана");
      expect(s).not.toMatch("стоп-листе");
      expect(s).not.toMatch("выбор и заказ");
      expect(s).not.toMatch("звонишь");
      expect(s).toMatch("О себе говори в роде своего персонажа. Пол сотрудника тебе неизвестен: не называй его «девушка» или «молодой человек».");
      expect(s).toMatch("даже если в прошлых репликах его не видно");
      expect(s).toMatch(/\[\[end\]\]\.$/);
    }
  });
  it("звонок на стойку хостес — телефонный разговор: свободное время видят все, бронь повторяют вслух", async () => {
    const ai = await loadAi();
    const g = ai.trustedGuest({ id: "phone", menu: ["Борщ"] });
    expect([g.phone, ai.sceneOf(g), ai.trustedGuest({ id: "booked" }).phone]).toEqual([true, "phone", false]);
    const s = ai.buildGuestSystem({}, g);
    expect(s).toMatch("Ты звонишь в ресторан, трубку берёт хостес — живой человек");
    // что свободно в книге броней, видит только хостес (на карточке) и Наставник — не гость
    expect(s).not.toMatch("книге броней");
    expect(s).toMatch("Где: звонок на стойку хостес (гостя не видят, только слышат).");
    expect(s).toMatch("Свободно ли нужное время, ты узнаешь от хостес.");
    expect(s).toMatch("Когда бронь записана и повторена, хостес попрощалась или стало ясно, что бронировать не будешь");
    expect(s).toMatch("Звонок: приветствие → дата, время, сколько гостей → пожелания → имя и телефон → хостес повторяет бронь → прощание.");
    expect(s).not.toMatch("Тебя встречает хостес");
    expect(s).not.toMatch("посадили куда попало");
    expect(s).not.toMatch("Меню ресторана");
    const r = ai.buildReceiptSystem({}, g, "spg");
    expect(r).toMatch("Перед тобой учебный телефонный разговор хостес с гостем, который бронирует стол; гостя играл ИИ.");
    expect(jsonKeys(r)).toEqual(["contact", "book", "care", "seat", "calm"]);
    expect(r).toMatch("contact — начало звонка: ответить, назвать ресторан и себя, тон; book — бронь: дата, время, сколько гостей, имя, телефон, пожелания — и повторить бронь вслух;");
    expect(r).toMatch("Меню, заказ блюд и аперитив по телефону не обсуждают");
    expect(r).toMatch("Что видит сотрудник (гость этого не знает): в книге броней на субботу свободно только с 20:15.");
    const app = pickGuest({ role: "spg", seed: 1, prefer: "phone" });
    expect(app.note).toBe("В книге броней на субботу свободно только с 20:15");
  });
  it("проводы на выходе — своя сцена: благодарность, как прошёл вечер, гардероб, такси; бронь и рассадка в вину не ставятся", async () => {
    const ai = await loadAi();
    const g = ai.trustedGuest({ id: "leaving" });
    expect([g.exit, ai.sceneOf(g)]).toEqual([true, "exit"]);
    const s = ai.buildGuestSystem({}, g);
    expect(s).toMatch("Тебя провожает хостес — живой человек");
    expect(s).toMatch("Где: стойка хостес у выхода.");
    expect(s).toMatch("Проводы: благодарность за визит → как прошёл вечер → гардероб → такси (сколько ждать, какая машина, где подождать) → прощание.");
    expect(s).toMatch("Если хостес советует блюда или напитки — скажи, что вы уже поужинали.");
    expect(s).not.toMatch("посадили куда попало");
    expect(s).not.toMatch("провожает к столу");
    const r = ai.buildReceiptSystem({}, g, "spg");
    expect(r).toMatch("Перед тобой учебный диалог хостес с гостем, который уходит после ужина; гостя играл ИИ.");
    expect(r).toMatch("contact — заметить гостя, поблагодарить за визит, тон; book — ожидание: честно сказать, когда будет такси");
    expect(r).toMatch("Бронь, рассадка, заказ и аперитив здесь ни при чём — не ставь их в вину.");
    expect(receiptKind({ place: "door", exit: true })).toBe("exit");
    expect(criteriaOf("exit").map((c) => c[1])).toEqual(["Внимание к гостю", "Такси и ожидание", "Забота о госте", "Проводы", "Спокойствие"]);
  });
  it("хостес: чек — встреча, бронь, рассадка; аперитив и меню в вину не ставятся; уроки — только хостес", async () => {
    const ai = await loadAi();
    const s = ai.buildReceiptSystem({}, ai.trustedGuest({ id: "booked" }), "spg");
    expect(jsonKeys(s)).toEqual(["contact", "book", "care", "seat", "calm"]);
    expect(s).toMatch("Перед тобой учебный диалог хостес с гостем у стойки хостес; гостя играл ИИ.");
    expect(s).toMatch("ТОЛЬКО по обязанностям хостес");
    expect(s).toMatch("Приём заказа, советы по блюдам, продажа аперитива и расчёт — работа официанта: не ставь хостес в вину, если этого не было, и не пиши об этом ни в fix, ни в phrase.");
    expect(s).toMatch("Предложить воду или подождать у бара, пока гость ждёт стол, — это забота (care).");
    expect(s).toMatch("Если хостес сама советует блюда или продаёт аперитив — не хвали за это");
    expect(s).toMatch("book — бронь и ожидание: гость с бронью — быстро найти её и подтвердить стол, брони нет — честно назвать время ожидания и предложить, где подождать;");
    expect(s).toMatch("Пол сотрудника неизвестен: в good, fix и phrase не используй слов с родом");
    expect(s).toMatch('"lessons": ["…"]}');
    expect(s).not.toMatch(/"lessons": \["[a-z]/);
    const les = ids(mapPart(s));
    expect(les.length).toBeGreaterThan(40);
    expect(les.every((x) => /^spg-/.test(x))).toBe(true);
  });
  it("менеджер: гость позвал менеджера, заказ ему не делает; чек — разбор и решение; уроки — менеджера", async () => {
    const ai = await loadAi();
    const g = ai.trustedGuest({ id: "steak", table: 7, menu: ["Стейк рибай"], stop: ["Тирамису"] });
    const s = ai.buildGuestSystem({}, g);
    expect(s).toMatch("К тебе подходит менеджер зала — живой человек");
    expect(s).toMatch("Где: за столом в зале, стол 7. Гость попросил позвать менеджера — к нему подходит менеджер зала.");
    expect(s).toMatch("менеджера позвали по твоей просьбе, и он подошёл");
    expect(s).toMatch("Не заказывай у менеджера ужин и не жди от него аперитива — это работа официанта. Всё, что касается твоей ситуации (замена блюда, меню банкета, выпивка, счёт), обсуждай с ним.");
    expect(s).toMatch("Меню ресторана (если речь зайдёт о блюдах — только отсюда): Стейк рибай.");
    expect(s).not.toMatch("стоп-листе");
    const r = ai.buildReceiptSystem({}, g, "manager");
    expect(jsonKeys(r)).toEqual(["contact", "listen", "care", "solve", "calm"]);
    expect(r).toMatch("не ставь менеджеру в вину, если их не было");
    expect(r).toMatch("contact — первая фраза и тон: подойти, представиться, взять вопрос на себя; listen — разбор: выслушать до конца");
    expect(r).toMatch("предложение по банкету — дата, гости, бюджет, меню");
    expect(r).toMatch("Если пункт в этой сцене ни при чём (банкет — не жалоба: извиняться не за что) — не снижай за него оценку.");
    expect(s).toMatch("если есть претензия — извиниться от лица заведения и не перекладывать вину на сотрудников");
    expect(r).not.toMatch(/подошёл|выслушал|извинился|проследил/);
    expect(ids(mapPart(r)).every((x) => /^m\d/.test(x))).toBe(true);
    const sm = ids(mapPart(ai.buildReceiptSystem({}, g, "service_manager")));
    expect(sm.some((x) => /^sm\d/.test(x)) && sm.some((x) => /^m\d/.test(x)) && sm.every((x) => /^s?m\d/.test(x))).toBe(true);
  });
  it("бармен: разговор у стойки о напитках; чек — знание бара; уроки — бара", async () => {
    const ai = await loadAi();
    const g = ai.trustedGuest({ id: "driver", menu: ["Мохито"], stop: ["Апероль"] });
    const s = ai.buildGuestSystem({}, g);
    expect(s).toMatch("Перед тобой БАРМЕН, ты у стойки.");
    expect(s).not.toMatch("закуск");
    expect(s).toMatch("Сегодня в стоп-листе");
    const r = ai.buildReceiptSystem({}, g, "bar");
    expect(jsonKeys(r)).toEqual(["contact", "drinks", "care", "sales", "calm"]);
    expect(ids(mapPart(r)).every((x) => /^bar\d/.test(x))).toBe(true);
  });
  it("официант: визит и чек как до v42; уроки — официанта (новичку — только первая ступень)", async () => {
    const ai = await loadAi();
    const g = ai.trustedGuest({ id: "allergy", table: 4, menu: ["Борщ"], stop: ["Тирамису"] });
    const s = ai.buildGuestSystem({ restaurant: "Порт" }, g);
    expect(s).toMatch("Тебя обслуживает официант — живой человек, он тренируется.\n");
    expect(s).toMatch("Гость: Олег, 41 год. Ужинает с женой. Повод: просто вечер вдвоём.");
    expect(s).toMatch("Где: за столом в зале, стол 4.");
    expect(s).toMatch("Меню ресторана (заказывай только отсюда): Борщ.");
    expect(s).toMatch("— Визит идёт по шагам: встреча → выбор и заказ → вопросы по блюдам/напиткам → ожидание/подача → расчёт и прощание.");
    expect(s).toMatch("(не спросили про аллергию, предложили блюдо из стоп-листа, не назвали время ожидания)");
    expect(s).toMatch("— В конце КАЖДОЙ реплики отдельной строкой маркер настроения: [[mood:N]] (1 — раздражён … 5 — в восторге), даже если в прошлых репликах его не видно. Когда уходишь — ещё и [[end]].");
    const r = ai.buildReceiptSystem({}, g, "seasonal");
    expect(jsonKeys(r)).toEqual(["contact", "menu", "care", "sales", "calm"]);
    expect(r).toMatch("contact — встреча, контакт, тон; menu — знание меню, честность, стоп-лист;");
    expect(r).toMatch("Разговор заканчивается репликой гостя: не ставь в вину то, что сотрудник не успел сказать после неё");
    expect(r).not.toMatch("Что видит сотрудник");
    const s1 = ids(mapPart(r));   // первая ступень: s0-1…, s-prod-1…
    expect(s1.length).toBeGreaterThan(60);
    expect(s1.every((x) => /^s(\d|-)/.test(x))).toBe(true);
    const core = ids(mapPart(ai.buildReceiptSystem({}, g, "core")));   // ядру — обе ступени (c1-1…)
    expect(core.some((x) => /^c\d/.test(x)) && core.some((x) => /^s(\d|-)/.test(x))).toBe(true);
    expect(core.every((x) => /^(s\d|s-|c\d)/.test(x))).toBe(true);
  });
  it("уроки на повтор — из трека, который человек проходит (их приложение откроет); без трека — по роли", async () => {
    const ai = await loadAi();
    // хостес по должности на треке «Новичок»: гость у входа, а уроки — первой ступени официанта
    const door = ids(mapPart(ai.buildReceiptSystem({}, ai.trustedGuest({ id: "nobook" }), "seasonal")));
    expect(door.length > 20 && door.every((x) => /^s(\d|-)/.test(x))).toBe(true);
    // приложение до v42 не шлёт трек — уроки по роли гостя
    expect(ids(mapPart(ai.buildReceiptSystem({}, ai.trustedGuest({ id: "nobook" }), ""))).every((x) => /^spg-/.test(x))).toBe(true);
    expect(ids(mapPart(ai.buildReceiptSystem({}, ai.trustedGuest({ id: "bill" }), ""))).some((x) => /^sm\d/.test(x))).toBe(true);
    expect(ai.lessonMapFor("hall", "нет такого")).toBe(ai.lessonMapFor("hall", ""));
  });
  it("пункты чека в приложении и на сервере совпадают по ключам для каждой роли", async () => {
    const ai = await loadAi();
    const one = { hall: "rush", door: "vip", bar: "strong", manager: "bill", phone: "phone", exit: "leaving" };
    Object.entries(one).forEach(([kind, id]) => {
      const g = ai.trustedGuest({ id });
      expect([kind, ai.sceneOf(g), jsonKeys(ai.buildReceiptSystem({}, g, ""))]).toEqual([kind, kind, CRITERIA_BY_PLACE[kind].map((c) => c[0])]);
    });
  });
  it("трек из запроса — только из списка; возраст гостя — по-русски", async () => {
    const ai = await loadAi();
    expect(ai.GUEST_TRACKS).toEqual(["seasonal", "core", "spg", "bar", "manager", "service_manager"]);
    expect(ai.guestCard(ai.trustedGuest({ id: "booked" }))).toMatch("Елена, 44 года.");
    expect(ai.guestCard(ai.trustedGuest({ id: "phone" }))).toMatch("Вадим, 40 лет.");
    const src = readFileSync("supabase/functions/ai-chat/index.ts", "utf8");
    expect(src).toMatch('const track = GUEST_TRACKS.includes(String(trackIn ?? "")) ? String(trackIn) : "";');
    expect(src).toMatch("buildReceiptSystem(emp, guest as Guest, track)");
    // Наставник знает, что живой гость теперь по роли
    expect(src).toMatch("хостес — гость у входа (бронь, ожидание, рассадка; заказ там не делают)");
  });
});

describe("экран и тексты", () => {
  it("карточка живого гостя рисуется для каждой роли: строка роли и кнопка", async () => {
    const { LiveGuestScreen } = await import("../ui/live-guest");
    const { SPG_MODULES } = await import("../data/modules-spg");
    const R = (role, position) => renderToString(React.createElement(LiveGuestScreen, { a11y: false, profile: { id: "u1", name: "Тест", surname: "Тестов", restaurant: "Два моря, Океан", position },
      role, uk: "_x", color: "#C8917A", track: [SPG_MODULES[0]], modules: [SPG_MODULES[0]], dishes: [{ name: "Борщ" }], drinks: [], onClose: () => {}, inline: true })).replace(/<!-- -->/g, "");
    for (let i = 0; i < 4; i++) {
      const door = R("spg", "waiter");
      expect(door).toMatch(/data-guest-role="door">Ты — хостес: /);
      expect(door).toMatch(/Встретить гостя|Ответить на звонок|Подойти к гостю/);
      expect(door).toContain("гость — ИИ · хостес");
    }
    const mgr = R("manager", "manager");
    expect(mgr).toMatch(/data-guest-role="manager">Ты — менеджер: гость позвал тебя разобраться/);
    expect(mgr).toContain("Подойти к гостю");
    expect(mgr).toMatch(/СТОЛ \d+</);
    const bar = R("bar", "bartender");
    expect(bar).toMatch(/data-guest-role="bar">Ты — бармен/);
    expect(bar).toContain("БАРНАЯ СТОЙКА");
    const hall = R("seasonal", "waiter");
    expect(hall).toMatch(/data-guest-role="hall">Ты — официант/);
    expect(hall).toContain("Подойти к столу");
  });
  it("экран шлёт трек, берёт слова и пункты чека по роли", () => {
    const src = readFileSync("ui/live-guest.jsx", "utf8");
    expect(src).toMatch('track: role || ""');
    expect(src).toMatch("parseReceipt(reply, knownLesson, receiptKind(guest))");
    expect(src).toMatch("const canFinish = myTurns >= 2 || (ended && myTurns >= 1);");   // гость простился после первой реплики — чек всё равно есть
    expect(src).toMatch("if (busy || !canFinish) return;");
    expect(src).toMatch("Говори как на смене — голосом или текстом.");
    expect(src).toMatch("ownHere ? <p className=\"lg-own\">В подборке есть гости вашего заведения: {ownHere}</p>");
    expect(src).toMatch("(rc.crit || CRITERIA).map(");
    expect(src).toMatch('<p className="lg-role" data-guest-role={guest.place}>{ui.role}</p>');
    expect(src).not.toMatch(">Рассчитать гостя<");
    expect(src).not.toMatch("Гость попросил счёт — разговор окончен");
    expect(src).toMatch("place: guest.place }}");   // гость по сценарию знает роль
  });
  it("гость по сценарию у входа и у менеджера — без «Гость рассчитался»", () => {
    const src = readFileSync("ui/table.jsx", "utf8");
    expect(src).toMatch('door: { done: "Встреча окончена", exitT: "Гость уйдёт без помощи — можно встретить нового." }');
    expect(src).toMatch('manager: { done: "Разговор окончен"');
    expect(src).toMatch("GUEST_MODE_PLACE[guest.place] ? { ...MODE.guest, ...GUEST_MODE_PLACE[guest.place] }");
  });
  it("плитка, гид и «Путь мастера» не обещают, что гость всегда заказывает из меню", () => {
    expect(readFileSync("App.jsx", "utf8")).toMatch("sub: guestSub(role, profile?.position)");
    const guide = readFileSync("ui/guide.jsx", "utf8");
    expect(guide).toMatch("хостес у входа (встреча, бронь, рассадка — заказ там не делают)");
    expect(guide).toMatch("пять оценок по шагам твоей роли");
    const ms = readFileSync("lib/mastery.js", "utf8");
    expect(ms).not.toMatch("заказывает из вашего меню");
    expect(readFileSync("ui/menu-trainer.jsx", "utf8")).toMatch(/· сборка v\d{2}</);   // v43: номер сборки растёт
    expect(readFileSync("CHANGES.md", "utf8")).toMatch(/# Дополнение 355 — «Живой гость» знает роль \(v42\)/);
    expect(readFileSync("supabase/README.md", "utf8")).toMatch("после выкладки v42 её нужно развернуть заново");
  });
});
