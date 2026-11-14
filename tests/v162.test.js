// v162 (Доп. 487): ещё один заход по виду. Владельцу показаны шесть предложений с картинками «сейчас / идея»,
// ответ: «Берем все».
//   1. Карточки чата о человеке («Спасибо», годовщина, день рождения, «Знакомьтесь», «Самостоятельная смена»): на
//      корешке — лицо того, о ком карточка. Фото нет — корешок прежний.
//   2. «Жизнь команды»: в строке — лицо того, чьё событие (фото или буквы), значок события в углу кружка.
//   3. Подиум «Лиги недели»: тройка с лицами, когда фото есть хотя бы у одного из троих.
//   4. Сертификат: бумажный лист (раньше карточка была шире экрана, рамку срезало), слова без «сдал(а)», срок
//      действия; «Поделиться картинкой» отправляет сам лист (lib/cert-image.js).
//   5. Список сотрудников у руководителя: лицо в строке, статус — точкой на кружке.
//   6. Мелочи: «Войти», «Поделиться», «Распечатать» — линзы; поле кода на «ты»; полоска «Первых шагов» слева направо.
// Везде: на сервере без этапа 52 (фото сотрудников) всё выглядит как раньше.
// Вид в браузере (обе темы, нажатия, сервер без этапа 52) — tools/claude/e2e-v162.mjs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store0 = {};
globalThis.localStorage = { getItem: (k) => (k in store0 ? store0[k] : null), setItem: (k, v) => { store0[k] = String(v); }, removeItem: (k) => { delete store0[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { setPhotoBackend, memoryBackend } from "../lib/photo-store";
import { loadStaffPhotos, staffThumbUrl, _resetStaffPhotos } from "../lib/staff-photo";
import { buildFeed } from "../lib/team-feed";
import { certView, certShareText, drawCert, certImage, CERT_W, CERT_H, CERT_MONTHS } from "../lib/cert-image";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const count = (s, part) => s.split(part).length - 1;
const noop = () => {};

// ── сервер в памяти (тот же, что в демо) и «телефон»: фото есть у Марии, у Ксении нет; вошла Анна ──────────
const R0 = "Два моря, Океан";
const PEOPLE = [
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ksenia", name: "Ксения", surname: "Миронова", restaurant: R0, position: "waiter", is_admin: false },
];
const TOK = { tm: "u-maria", ta: "e-anna", tk: "e-ksenia" };
const F1 = "QUJD".repeat(40), T1 = "REVG".repeat(12);
const url = (x) => "data:image/jpeg;base64," + x;
const realFetch = globalThis.fetch, realLS = globalThis.localStorage;
const phone = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const enter = async () => {
  globalThis.localStorage = phone(); setPhotoBackend(memoryBackend()); _resetStaffPhotos();
  const srv = makeServer({ today: "2026-11-15", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, staffPhotos: { "u-maria": { full: F1, thumb: T1 } } });
  globalThis.fetch = async (u, init = {}) => ({ ok: true, status: 200, json: async () => srv.rpc(String(u).split("/rpc/")[1], JSON.parse(init.body || "{}")) });
  globalThis.localStorage.setItem("sa_session_token", "ta");
  const list = await loadStaffPhotos();
  await Promise.all(list.items.map((x) => staffThumbUrl(x.id, x.ver)));
  return list;
};
const leave = () => { globalThis.fetch = realFetch; globalThis.localStorage = realLS; setPhotoBackend(null); _resetStaffPhotos(); };

const ME = { id: "e-anna" };
const row = (card, emp = "") => ({ m: { id: 7, emp, name: emp ? "Анна Смирнова" : "Академия", at: "2026-11-15T09:00:00", kind: "card", card } });
const CARDS = {
  thx: (to, plus = []) => row({ t: "thx", to, text: "помогла с банкетом", plus }, "e-anna"),
  bday: (emp, name) => row({ t: "bday", emp, name, pos: "manager", greet: [] }),
  anniv: (emp, name, years) => row({ t: "anniv", emp, name, pos: "manager", years, since: "2024-11-15", greet: [] }),
  hello: (emp, name) => row({ t: "hello", emp, name, pos: "waiter", greet: [] }, "e-anna"),
  solo: (emp, name, days) => row({ t: "solo", emp, name, pos: "waiter", days, greet: [] }, "e-anna"),
};
const MARIA = { id: "u-maria", name: "Мария Ким" }, KSENIA = { id: "e-ksenia", name: "Ксения Миронова" };
// корешок карточки: всё, что внутри .ch-card-tile
const tileOf = (html) => /<div class="ch-card-tile">([\s\S]*?)<\/div><div class="ch-card-main">/.exec(html)[1];

describe("v162: лицо на корешке карточки о человеке (ui/chat-cards.jsx)", () => {
  let CardMsg, FaceTile;
  const card = (r) => R(h(CardMsg, { row: r, me: ME, onAct: noop, onMenu: noop }));
  beforeAll(async () => { await enter(); ({ CardMsg, FaceTile } = await import("../ui/chat-cards.jsx")); });
  afterAll(leave);

  it("«Спасибо»: на корешке фото того, кому спасибо; значок — в углу кружка; подпись словом", () => {
    const t = tileOf(card(CARDS.thx(MARIA)));
    expect(t).toMatch(/^<span class="ch-tl ch-tl-f" aria-hidden="true" data-chat-card-face="u-maria"><span class="ch-tl-face"><img data-face="u-maria" data-face-zoom="quiet" src="/);
    expect(t).toContain('src="' + url(T1) + '"');
    expect(t).toMatch(/<span class="ch-tl-fb"><svg[\s\S]*?<\/svg><\/span><\/span><i>спасибо<\/i><\/span>$/);
    expect(t).not.toContain("ch-tl-i");                                            // прежнего корешка со значком нет
    expect(t).not.toContain('role="button"');                                      // корешок скрыт от диктора: фото открывается касанием, кнопкой не объявляется
  });
  it("«3 спасибо»: число — в углу кружка вместо значка, подпись остаётся словом и не упирается в края корешка", () => {
    const t = tileOf(card(CARDS.thx(MARIA, [{ id: "e-ksenia", name: "Ксения Миронова" }, { id: "e-x", name: "Пётр Орлов" }])));
    expect(t).toContain('<span class="ch-tl-fb num" data-chat-card-n="">3</span></span><i>спасибо</i>');
    expect(t).not.toContain("<svg");
    expect(t).not.toContain("<b>");
  });
  it("годовщина — «2 года» в подписи и звезда в углу; день рождения — «праздник» и подарок", () => {
    const a = tileOf(card(CARDS.anniv("u-maria", "Мария Ким", 2)));
    expect(a).toMatch(/<span class="ch-tl-fb"><svg[\s\S]*?<\/svg><\/span><\/span><i><b>2<\/b>года<\/i><\/span>$/);
    const y1 = tileOf(card(CARDS.anniv("u-maria", "Мария Ким", 1))), y5 = tileOf(card(CARDS.anniv("u-maria", "Мария Ким", 5)));
    expect(y1).toContain("<i><b>1</b>год</i>"); expect(y5).toContain("<i><b>5</b>лет</i>");
    const b = tileOf(card(CARDS.bday("u-maria", "Мария Ким")));
    expect(b).toMatch(/<span class="ch-tl-fb"><svg[\s\S]*?<\/svg><\/span><\/span><i>праздник<\/i><\/span>$/);
    expect(b).toContain('data-chat-card-face="u-maria"');
  });
  it("«Знакомьтесь» — лицо и «новичок» без значка; «Самостоятельная смена» — «6 дней», а без срока — «сам»", () => {
    const hl = tileOf(card(CARDS.hello("u-maria", "Мария Ким")));
    expect(hl).toMatch(/data-face-zoom="quiet"[^>]*\/><\/span><i>новичок<\/i><\/span>$/);
    expect(hl).not.toContain("ch-tl-fb");
    expect(tileOf(card(CARDS.solo("u-maria", "Мария Ким", 6)))).toMatch(/<span class="ch-tl-fb"><svg[\s\S]*?<\/svg><\/span><\/span><i><b>6<\/b>дней<\/i><\/span>$/);
    expect(tileOf(card(CARDS.solo("u-maria", "Мария Ким", 0)))).toMatch(/<\/span><\/span><i>сам<\/i><\/span>$/);
  });
  it("фото у человека нет — корешок прежний: значок, число, слово", () => {
    const t = tileOf(card(CARDS.thx(KSENIA)));
    expect(t).toMatch(/^<span class="ch-tl ch-tl-i" aria-hidden="true"><span class="ch-tl-box"><svg/);
    expect(t).toMatch(/<i>спасибо<\/i><\/span>$/);
    expect(t).not.toContain("data-chat-card-face");
    const n3 = tileOf(card(CARDS.thx(KSENIA, [{ id: "a", name: "А Б" }, { id: "b", name: "В Г" }])));
    expect(n3).toMatch(/^<span class="ch-tl ch-tl-d" aria-hidden="true"><span class="ch-tl-ic"><svg[\s\S]*?<\/svg><\/span><b>3<\/b><i>спасибо<\/i><\/span>$/);
    expect(tileOf(card(CARDS.anniv("e-ksenia", "Ксения Миронова", 2)))).toMatch(/<b>2<\/b><i>года<\/i><\/span>$/);
    expect(tileOf(card(CARDS.hello("e-ksenia", "Ксения Миронова")))).toMatch(/^<span class="ch-tl ch-tl-i"[\s\S]*<i>новичок<\/i><\/span>$/);
    expect(tileOf(card(CARDS.solo("e-ksenia", "Ксения Миронова", 0)))).toMatch(/<i>сам<\/i><\/span>$/);
    expect(tileOf(card(CARDS.thx({ name: "Кто-то" })))).toMatch(/^<span class="ch-tl ch-tl-i"/);   // номера человека нет — тоже прежний
  });
  it("FaceTile: без фото отдаёт то, что ему дали запасным; остальная карточка от лица не меняется", () => {
    expect(R(h(FaceTile, { emp: "e-ksenia", cap: "спасибо", fallback: h("u", null, "как было") }))).toBe("<u>как было</u>");
    expect(R(h(FaceTile, { emp: "", cap: "спасибо", fallback: h("u", null, "как было") }))).toBe("<u>как было</u>");
    expect(R(h(FaceTile, { emp: null, cap: "спасибо" }))).toBe("");
    const withFace = card(CARDS.thx(MARIA)), plain = card(CARDS.thx({ ...KSENIA, name: "Мария Ким" }));
    const strip = (x) => x.replace(/<div class="ch-card-tile">[\s\S]*?<\/div>(?=<div class="ch-card-main">)/, "").replace(/data-chat-thx-to="[^"]*"/, "");
    expect(strip(withFace)).toBe(strip(plain));
  });
});

describe("v162: карточки о человеке на сервере без этапа 52 — как раньше", () => {
  it("списка фото нет — у всех пяти карточек прежние корешки", async () => {
    leave();
    const { CardMsg } = await import("../ui/chat-cards.jsx");
    const card = (r) => R(h(CardMsg, { row: r, me: ME, onAct: noop, onMenu: noop }));
    for (const r of [CARDS.thx(MARIA), CARDS.bday("u-maria", "Мария Ким"), CARDS.anniv("u-maria", "Мария Ким", 2), CARDS.hello("u-maria", "Мария Ким"), CARDS.solo("u-maria", "Мария Ким", 6)]) {
      const t = tileOf(card(r));
      expect(t).not.toContain("ch-tl-f"); expect(t).not.toContain("data-face");
      expect(t).toMatch(/^<span class="ch-tl ch-tl-[id]" aria-hidden="true">/);
    }
  });
  it("разметка и стили корешка", () => {
    const k = rd("ui/chat-cards.jsx");
    expect(k).toContain('import { FaceImg, useFace } from "./staff-photo";');
    expect(count(k, "<FaceTile ")).toBe(4);                                         // «Знакомьтесь», «Самостоятельная смена», «Спасибо», день рождения и годовщина
    expect(k).toContain("const e = useFace(emp != null && emp !== \"\" ? { id: String(emp) } : null);");
    expect(k).toContain("if (!e) return fallback;");
    expect(k).toContain("<FaceImg who={{ id: e.id }} zoom quiet />");               // касание открывает фото крупно и дальше не идёт: меню карточки не открывается
    expect(k).toContain(".ch-tl-face{position:relative;display:block;width:48px;height:48px;border-radius:50%;");
    expect(k).toContain(".ch-tl-fb{position:absolute;right:-6px;bottom:-4px;width:20px;height:20px;border-radius:50%;");
    expect(k).toContain(".ch-tl-fb.num{width:auto;min-width:20px;padding:0 5px;");
    expect(k).toContain("pointer-events:none}\n.ch-tl-fb svg");                    // значок в углу касаний не ловит — они идут фото
    expect(k).not.toMatch(/\.ch-tl-f[^{]*\{[^}]*font-size:(8|8\.5|9|9\.5|10)px/);   // подпись не мельче 10.5
    expect(k).toContain(".ch-tl-f i{margin-top:7px;font-style:normal;font-size:10.5px;");
  });
});

describe("v162: «Жизнь команды» — чьё событие (lib/team-feed.js, ui/home-hubs.jsx)", () => {
  const NOW = Date.parse("2026-11-15T07:00:00Z");
  const ago = (hrs) => new Date(NOW - hrs * 3600000).toISOString();
  const me = { name: "Анна", surname: "Смирнова", restaurant: R0 };
  const items = buildFeed({ now: NOW, me, restaurant: R0, titleOf: () => "Тест: первый день",
    scores: [{ name: "Мария", surname: "Ким", restaurant: R0, quiz_id: "q1", score: 9, total: 10, updated_at: ago(2) },
      { name: "Анна", surname: "Смирнова", restaurant: R0, quiz_id: "q1", score: 10, total: 10, updated_at: ago(3) },
      { name: "Ксения", surname: "Миронова", restaurant: R0, quiz_id: "q1", score: 8, total: 10, updated_at: ago(4) }],
    masters: [{ who: "Вера С.", role: "core", at: ago(24 * 9) }, { me: true, who: "Анна С.", role: "core", at: ago(30) }],
    achievements: [{ name: "Ксения", surname: "Миронова", key: "streak", value: 5, at: ago(6) }],
    thanks: [{ name: "Мария Ким" }, { name: "Анна", me: true }] });
  const by = (kind, who) => items.find((x) => x.kind === kind && x.who === who);

  it("у каждой строки ленты — чьё это событие: имя и фамилия полностью; у своих строк — я сам", () => {
    expect(items.length).toBe(8);
    expect(by("test", "Мария К.").face).toEqual({ name: "Мария", surname: "Ким" });
    expect(by("test", "Ты").face).toEqual({ name: "Анна", surname: "Смирнова" });
    expect(by("record", "Ксения М.").face).toEqual({ name: "Ксения", surname: "Миронова" });
    expect(by("master", "Вера С.").face).toEqual({ name: "Вера", surname: "С." });       // сервер знает только букву — фото не найдётся, будут буквы
    expect(by("master", "Ты").face).toEqual({ name: "Анна", surname: "Смирнова" });
    expect(by("thanks", "Мария Ким").face).toEqual({ name: "Мария", surname: "Ким" });
    expect(by("thanks", "Ты").face).toEqual({ name: "Анна", surname: "Смирнова" });
    // слова строк не изменились
    expect(by("test", "Мария К.").text).toBe("сдала тест «Первый день» на 90%");
    expect(by("test", "Ты").text).toBe("сдал(а) тест «Первый день» на 100%");
  });

  describe("с фото сотрудников", () => {
    let TeamFeed;
    beforeAll(async () => { await enter(); ({ TeamFeed } = await import("../ui/home-hubs")); });
    afterAll(leave);
    it("в строке — кружок 32 px: буквы, поверх фото (у кого есть), значок события в углу", () => {
      const html = R(h(TeamFeed, { a11y: false, items, now: NOW, first: 10 }));
      expect(count(html, 'data-feed-face=""')).toBe(8);
      expect(count(html, 'data-face="u-maria"')).toBe(2);                           // тест и «спасибо» Марии
      expect(html).toMatch(/data-feed-face="" style="position:relative;width:32px;height:32px;[^"]*">МК<img data-face="u-maria" data-face-zoom="quiet" src="/);
      expect(html).toMatch(/data-feed-face="" style="[^"]*">КМ<span data-feed-kind="test"/);      // у Ксении фото нет — буквы
      expect(html).toMatch(/data-feed-face="" style="[^"]*">ВС<span data-feed-kind="master"/);   // «Вера С.» — буквы
      expect(html).toMatch(/data-feed-face="" style="[^"]*">АС<span data-feed-kind="thanks"/);   // «Ты» — мои буквы
      expect(html).toMatch(/<span data-feed-kind="record" style="position:absolute;right:-5px;bottom:-4px;width:16px;height:16px;[^"]*pointer-events:none[^"]*"><svg width="10" height="10"/);
      expect(html).not.toContain('width="13" height="13"');
      // кружок скрыт от диктора (имя — в тексте строки), фото открывается касанием
      expect(html).toContain('<span aria-hidden="true" data-lens="disc" data-feed-face=""');
      expect(html).not.toContain('role="button"');
    });
    it("строка без «чьё событие» (старый вид данных) — прежний кружок со значком, даже когда фото есть", () => {
      const html = R(h(TeamFeed, { a11y: false, items: [{ kind: "thanks", who: "Ольга", text: "сказала спасибо команде", at: NOW }], now: NOW }));
      expect(html).not.toContain("data-feed-face");
      expect(html).toMatch(/<span aria-hidden="true" data-lens="disc" style="width:24px;height:24px;[^"]*"><svg width="13" height="13"/);
    });
    it("в виде «Для чтения» кружок и значок на светлом", () => {
      const html = R(h(TeamFeed, { a11y: true, items, now: NOW, first: 10 }));
      expect(html).toContain("background:#FBF5E6;box-shadow:0 0 0 1px rgba(122,93,42,0.5)");
      expect(count(html, 'data-feed-face=""')).toBe(8);
    });
  });

  it("на сервере без этапа 52 лента как была: кружок 24 px со значком события, лиц и букв нет", async () => {
    leave();
    const { TeamFeed } = await import("../ui/home-hubs");
    const html = R(h(TeamFeed, { a11y: false, items, now: NOW, first: 10 }));
    expect(html).not.toContain("data-feed-face"); expect(html).not.toContain("data-face"); expect(html).not.toContain("data-feed-kind");
    expect(count(html, 'width:24px;height:24px')).toBe(8);
    expect(count(html, '<svg width="13" height="13"')).toBe(8);
    expect(html).not.toMatch(/>(МК|КМ|ВС|АС)</);
    const hub = rd("ui/home-hubs.jsx");
    expect(hub).toContain("const faces = useStaffPhotos();");
    expect(hub).toContain('const faceOn = !!faces && faces !== "missing";');
    // прежний кружок остался в разметке буква в букву
    expect(hub).toContain('<span aria-hidden="true" data-lens="disc" style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center",');
    const fn = hub.slice(hub.indexOf("export function TeamFeed("));
    expect(fn.indexOf("const faces = useStaffPhotos();")).toBeLessThan(fn.indexOf("if (!Array.isArray(items) || !items.length) return null;"));   // хук — до выхода из функции
  });
});

describe("v162: подиум «Лиги недели» с лицами (ui/league.jsx)", () => {
  const lg = rd("ui/league.jsx");
  it("лица — когда фото есть хотя бы у одного из тройки; иначе подиум как был", () => {
    expect(lg).toContain("const podFace = podium.some((r) => !!staffPhotoOf(faceList, faceOf(r)));");
    expect(lg).toContain("{podFace ? (\n                        <span data-lg-pod-face=\"\" aria-hidden=\"true\"");
    expect(lg).toContain('margin: podFace ? "14px 0 14px" : "4px 0 14px"');
    expect(lg).toContain("width: k === 0 ? 58 : 46, height: k === 0 ? 58 : 46");   // первое место крупнее
  });
  it("в кружке — буквы и фото по правилу лиги (свои — да, чужое заведение — буквы); касание открывает фото крупно", () => {
    expect(lg).toContain("{initialsOfPerson(r.name, r.surname)}\n                          <FaceImg who={faceOf(r)} zoom quiet sub={POSITION_LABEL[r.position] || \"\"} />");
    expect(lg).toContain("const faceOf = (r) => (r && (r.me || (!!myRest && (r.restaurant || \"\") === myRest)) ? { id: r.id } : null);");
    expect(lg).toContain('import { RankFace, FaceImg, useStaffPhotos } from "./staff-photo";');
    expect(lg).toContain('import { staffPhotoOf, initialsOfPerson } from "../lib/staff-photo";');
    expect(lg).toContain("boxShadow: `0 0 0 2px ${medal[k]}`");                    // ободок цвета медали
  });
});

describe("v162: слова и картинка сертификата (lib/cert-image.js)", () => {
  const P = { name: "Анна", surname: "Смирнова", restaurant: R0 };
  const NOW = Date.parse("2026-11-15T07:00:00Z");
  // 06:00 UTC — тот же день от Нью-Йорка до Камчатки
  const RES = { passed: true, score: 92, correct: 23, total: 25, date: "2026-11-12T06:00:00.000Z" };

  it("certView: имя, роль, «сдан на 92%», дата, срок действия на год", () => {
    expect(CERT_MONTHS).toBe(12);
    expect(certView({ profile: P, roleLabel: "Ядро", result: RES, now: NOW })).toEqual({ name: "Анна Смирнова", role: "Ядро", score: 92, done: "сдан на 92%",
      date: "12 ноября 2026", until: "12 ноября 2027", expired: false, restaurant: R0 });
  });
  it("certView: без процента — «сдан»; без даты — без срока; срок вышел — expired; пусто — «Сотрудник»", () => {
    const a = certView({ profile: P, roleLabel: "Бар", result: { passed: true, date: RES.date }, now: NOW });
    expect([a.score, a.done]).toEqual([null, "сдан"]);
    const b = certView({ profile: P, roleLabel: "Бар", result: { passed: true, score: 84.6 }, now: NOW });
    expect([b.score, b.done, b.date, b.until, b.expired]).toEqual([85, "сдан на 85%", "", "", false]);
    const old = certView({ profile: P, roleLabel: "Бар", result: { ...RES, date: "2025-03-01T06:00:00.000Z" }, now: NOW });
    expect([old.date, old.until, old.expired]).toEqual(["1 марта 2025", "1 марта 2026", true]);
    expect(certView({ profile: P, roleLabel: "Бар", result: { ...RES, date: "не дата" }, now: NOW }).date).toBe("");
    const none = certView();
    expect([none.name, none.role, none.done, none.restaurant]).toEqual(["Сотрудник", "", "сдан", ""]);
    expect(certView({ profile: { name: " Ян ", surname: "" }, roleLabel: " Зал ", result: null }).name).toBe("Ян");
  });
  it("certShareText: без «сдал(а)», с подписью; пусто — одна строка", () => {
    const v = certView({ profile: P, roleLabel: "Ядро", result: RES, now: NOW });
    expect(certShareText(v)).toBe("Экзамен на роль «Ядро» в Service Academy сдан на 92%.\nАнна Смирнова · " + R0);
    expect(certShareText(certView({ profile: { name: "Ян" }, roleLabel: "Бар", result: { passed: true } }))).toBe("Экзамен на роль «Бар» в Service Academy сдан.\nЯн");
    expect(certShareText(certView())).toBe("Экзамен на роль в Service Academy сдан.");
    expect(certShareText()).toBe("Экзамен на роль в Service Academy сдан.");
    expect(certShareText(v)).not.toMatch(/сдал\(а\)| — /);
  });

  function fakeCtx({ spacing = true, ellipse = true } = {}) {
    const calls = [], shapes = [];
    const grad = () => ({ addColorStop() {} });
    const ctx = {
      calls, shapes, font: "10px serif", fillStyle: "", strokeStyle: "", lineWidth: 1, textAlign: "left", textBaseline: "alphabetic", lineJoin: "", lineCap: "",
      createLinearGradient: grad, createRadialGradient: grad, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {}, stroke() {},
      arc(x, y, r) { shapes.push({ k: "arc", x, y, r }); }, bezierCurveTo() { shapes.push({ k: "bez" }); },
      fill() { shapes.push({ k: "fill", style: this.fillStyle }); },
      measureText(t) { const px = parseFloat((String(this.font).match(/([\d.]+)px/) || [0, 10])[1]); return { width: [...String(t)].length * px * 0.55 }; },
      fillText(t, x, y) { calls.push({ t: String(t), x, y, font: this.font, color: this.fillStyle, align: this.textAlign }); },
    };
    if (spacing) ctx.letterSpacing = "0px";
    if (ellipse) ctx.ellipse = (x, y) => { shapes.push({ k: "ell", x, y }); };
    return ctx;
  }
  it("drawCert: знак, «Сертификат», имя, «Экзамен на роль», роль, «сдан на» и процент, дата, срок, заведение; всё в пределах 1080×1350", () => {
    expect([CERT_W, CERT_H]).toEqual([1080, 1350]);
    const ctx = fakeCtx();
    drawCert(ctx, { ...certView({ profile: P, roleLabel: "Ядро", result: RES, now: NOW }), color: "#7FA08A" });
    const t = ctx.calls.map((c) => c.t);
    for (const s of ["SERVICE ACADEMY", "Сертификат", "Анна Смирнова", "Экзамен на роль", "Ядро", "сдан на ", "92%", "12 ноября 2026", "действует до 12 ноября 2027", R0]) expect([s, t.includes(s)]).toEqual([s, true]);
    for (const c of ctx.calls) { expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x).toBeLessThanOrEqual(1080); expect(c.y).toBeGreaterThan(0); expect(c.y).toBeLessThan(1350); }
    const f = (s) => ctx.calls.find((c) => c.t === s);
    expect(f("Анна Смирнова").font).toMatch(/^700 92px 'Piazzolla'/);
    expect(f("Сертификат").font).toMatch(/^700 112px 'Piazzolla'/);
    expect(f("Экзамен на роль").font).toMatch(/^italic 40px Georgia/);              // курсив — шрифтом приложения, у которого он есть
    expect(f("92%").font).toMatch(/^700 42px Georgia/);
    // «сдан на» и процент стоят встык, вместе — по центру листа
    const a = f("сдан на "), b = f("92%");
    expect(a.y).toBe(b.y);
    expect(b.x).toBeCloseTo(a.x + 8 * 40 * 0.55, 5);
    expect((a.x + b.x + 3 * 42 * 0.55) / 2).toBeCloseTo(540, 5);
    // строки идут сверху вниз в порядке чтения
    const ys = ["SERVICE ACADEMY", "Сертификат", "Анна Смирнова", "Экзамен на роль", "Ядро", "92%", "12 ноября 2026", "действует до 12 ноября 2027", R0].map((s) => f(s).y);
    expect([...ys].sort((x, y) => x - y)).toEqual(ys);
    expect(f("действует до 12 ноября 2027").color).toBe("#735F44");
    // ромбик под заголовком — цветом роли
    expect(ctx.shapes.some((s) => s.k === "fill" && s.style === "#7FA08A")).toBe(true);
    // печать — справа внизу, шапочка нарисована линиями
    expect(ctx.shapes.some((s) => s.k === "arc" && s.x > 800 && s.y > 1000)).toBe(true);
    expect(ctx.shapes.filter((s) => s.k === "bez").length).toBe(2);
  });
  it("drawCert: длинное имя — двумя строками; срок вышел — красным; без процента — «сдан»; без разрядки и ellipse в ctx — тоже рисует", () => {
    const ctx = fakeCtx({ spacing: false, ellipse: false });
    drawCert(ctx, { ...certView({ profile: { name: "Александра-Виктория", surname: "Константинопольская", restaurant: "Два моря, Океан на набережной у старого маяка и ещё дальше" },
      roleLabel: "Менеджер зала и банкетов", result: { passed: true, date: "2025-03-01T06:00:00.000Z" }, now: NOW }), color: "красный" });
    const t = ctx.calls.map((c) => c.t);
    expect(t).toContain("Александра-Виктория"); expect(t).toContain("Константинопольская");
    expect(t).not.toContain("Александра-Виктория Константинопольская");
    expect(t).toContain("сдан"); expect(t).not.toContain("сдан на ");
    expect(t).toContain("Менеджер зала и банкетов");
    expect(ctx.calls.find((c) => c.t === "срок истёк 1 марта 2026").color).toBe("#8B3020");
    expect(t.filter((x) => x.length === 1).join("")).toContain("SERVICE ACADEMY");   // без letterSpacing — по буквам
    expect(t.some((x) => /^Два моря, Океан на набережной.*…$/.test(x))).toBe(true);   // длинное заведение не заходит под печать
    expect(ctx.shapes.some((s) => s.k === "fill" && s.style === "#8B6A30")).toBe(true);   // цвет роли не #RRGGBB — ромбик золотом рамки
    for (const c of ctx.calls) { expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x).toBeLessThanOrEqual(1080); expect(c.y).toBeLessThan(1350); }
  });
  it("drawCert: совсем без данных — «Сотрудник» и «сдан», без даты; в node картинки нет — null", async () => {
    const ctx = fakeCtx();
    drawCert(ctx, certView());
    const t = ctx.calls.map((c) => c.t);
    expect(t).toEqual(["SERVICE ACADEMY", "Сертификат", "Сотрудник", "Экзамен на роль", "сдан"]);
    drawCert(fakeCtx());                                                              // и вовсе без аргумента не падает
    expect(await certImage({ name: "Анна" })).toBe(null);
  });
});

describe("v162: экран «Сертификат» (ui/screens-exam.jsx)", () => {
  const T = { screen: {}, lessHead: {}, backBtn2: {}, lessHeadTitle: {}, lessBody: {}, para: { color: "#C8B898" } };
  const P = { name: "Анна", surname: "Смирнова", restaurant: R0 };
  const RES = { passed: true, score: 92, correct: 23, total: 25, date: "2026-11-12T06:00:00.000Z" };
  let CertificateScreen;
  beforeAll(async () => { ({ CertificateScreen } = await import("../ui/screens-exam.jsx")); });
  const screen = (extra = {}) => R(h(CertificateScreen, { T, a11y: false, profile: P, roleObj: { id: "core", label: "Ядро", color: "#7FA08A" }, result: RES, onExit: noop, shareUrl: "https://t.me/x", ...extra }));

  it("лист не шире экрана: ширина с полями и рамкой внутри (раньше рамку срезало по краям)", () => {
    const html = screen();
    expect(html).toMatch(/<div data-cert="" style="width:100%;max-width:380px;box-sizing:border-box;padding:9px;border-radius:8px;/);
    expect(rd("ui/screens-exam.jsx")).not.toContain('style={{ width:"100%", maxWidth:380, borderRadius:18, padding:"28px 22px"');
  });
  it("слова листа: имя, «Экзамен на роль», роль, «сдан на 92%», дата, срок действия, заведение; печать с шапочкой", () => {
    const html = screen();
    expect(html).toMatch(/<div data-cert-name="" style="[^"]*">Анна Смирнова<\/div>/);
    expect(html).toMatch(/>Экзамен на роль<\/div><div data-cert-role="" style="[^"]*">Ядро<\/div><div data-cert-done="" style="[^"]*">сдан на <b style="[^"]*">92%<\/b><\/div>/);
    expect(html).toMatch(/<div data-cert-date="" style="[^"]*">12 ноября 2026<\/div><div data-cert-until="" style="[^"]*color:#735F44[^"]*">действует до 12 ноября 2027<\/div><div style="[^"]*">Два моря, Океан<\/div>/);
    expect(html).toContain('data-now-seal=""');
    expect(html).not.toContain("сдал(а)"); expect(html).not.toContain("Настоящим подтверждается"); expect(html).not.toContain("Результат:");
    expect(html).toContain("background:#7FA08A");                                   // ромбик — цветом роли
  });
  it("лист одинаковый в тёмной теме и в «Для чтения»: это документ; меняется только тень", () => {
    const paper = (x) => /<div data-cert=""[\s\S]*?(?=<button type="button")/.exec(x)[0].replace(/box-shadow:[^"]*"/, '"').replace(/nhw\d+/g, "nhw");
    expect(paper(screen({ a11y: true }))).toBe(paper(screen()));
    expect(screen()).toContain("linear-gradient(168deg, #FCF8EE 0%, #F4ECD9 100%)");
  });
  it("кнопки: «Поделиться картинкой» — плашка-линза, «Поделиться текстом» — стекло, «Готово» — тихая; слоя просмотра сначала нет", () => {
    const html = screen();
    expect(html).toMatch(/<button type="button" class="sa-btn" data-lens-btn="main" data-cert-sharepic="" style="[^"]*"><svg[\s\S]*?<\/svg>Поделиться картинкой<\/button>/);
    expect(html).toMatch(/<button type="button" class="sa-btn" data-lens-btn="soft" data-cert-sharetext="" style="[^"]*">Поделиться текстом<\/button>/);
    expect(html).toMatch(/<button type="button" class="sa-btn" data-cert-done-btn="" style="[^"]*">Готово<\/button>/);
    expect(html).not.toContain("data-cert-preview"); expect(html).not.toContain("data-cert-sent");
    expect(html).toContain('data-lens="back" aria-label="Вернуться"');
  });
  it("без процента, без даты, без профиля — лист всё равно собран", () => {
    const html = R(h(CertificateScreen, { T, a11y: false, profile: null, roleObj: undefined, result: undefined, onExit: noop }));
    expect(html).toMatch(/<div data-cert-name="" style="[^"]*">Сотрудник<\/div>/);
    expect(html).toMatch(/<div data-cert-done="" style="[^"]*">сдан<\/div>/);
    expect(html).not.toContain("data-cert-date"); expect(html).not.toContain("data-cert-until");
    const old = screen({ result: { ...RES, date: "2025-03-01T06:00:00.000Z" } });
    expect(old).toMatch(/<div data-cert-until="" style="[^"]*color:#8B3020[^"]*">срок истёк 1 марта 2026<\/div>/);
  });
  it("«Поделиться»: картинка рисуется заранее и уходит файлом, иначе — просмотр со «Скачать»; текст — в чат Telegram или в буфер", () => {
    const e = rd("ui/screens-exam.jsx");
    expect(e).toContain('import { certView, certImage, certShareText } from "../lib/cert-image";');
    expect(e).toContain("certImage(data).then((b) => { if (!dead && b) setPic(b); }).catch(() => {});");
    expect(e).toContain('navigator.share({ files: [file], title: "Сертификат" }).then(() => setSent("Отправлено"), (e) => { if (!(e && e.name === "AbortError")) preview(blob); });');
    expect(e).toContain("if (!can) { preview(blob); return; }");
    expect(e).toContain('tg.openTelegramLink("https://t.me/share/url?url=" + encodeURIComponent(shareUrl || "") + "&text=" + encodeURIComponent(text)); setSent("Выбери чат в Telegram"); return;');
    expect(e).toContain('<a href={pv.url} download={picName} className="sa-btn" data-cert-save=""');
    expect(e).toContain('<button type="button" data-sa-back="" onClick={() => setPv(null)}');   // «назад» Telegram закрывает просмотр
    expect(e).toContain("{pvEl && typeof document !== \"undefined\" && document.body ? createPortal(pvEl, document.body) : pvEl}");
    // слой просмотра всегда тёмный — его кнопки не берут стили линз, которые зависят от темы
    const pv = e.slice(e.indexOf("const pvEl = pv ? ("), e.indexOf(") : null;", e.indexOf("const pvEl = pv ? (")));
    expect(pv).not.toContain("data-lens-btn");
    const app = rd("App.jsx");
    expect(app).toContain('onExit={() => navigate("certificates")} shareUrl={APP_SHARE_URL} /></Suspense>}');
    expect(app).not.toContain("Я сдал(а) экзамен на роль");
  });
});

describe("v162: список сотрудников — лица в строках (ui/screens-team.jsx)", () => {
  const t = rd("ui/screens-team.jsx");
  it("лица — когда на сервере есть фото; без этапа 52 — прежняя точка статуса", () => {
    expect(t).toContain('import { FaceImg, useStaffPhotos } from "./staff-photo";');
    expect(t).toContain("const facesList = useStaffPhotos();");
    expect(t).toContain('const faceOn = !!facesList && facesList !== "missing";');
    expect(t).toContain("{faceOn ? (");
    expect(t).toContain("<span style={{ width:9, height:9, borderRadius:6, flexShrink:0, background:st.color, boxShadow:`0 0 8px ${st.color}55` }} />");   // как было
    const fn = t.slice(t.indexOf("export function TeamScreen("));
    expect(fn.indexOf("const facesList = useStaffPhotos();")).toBeLessThan(fn.indexOf("const [list, setList]"));
  });
  it("в строке — кружок 38 px: буквы (у владельца — корона) и фото по номеру сотрудника; статус — точкой на кружке", () => {
    expect(t).toContain('<span data-emp-face="" aria-hidden="true" style={{ position:"relative", flexShrink:0, display:"inline-flex" }}>');
    expect(t).toContain('<span data-lens="disc" style={avatarLens(a11y, 38)}>');
    expect(t).toContain("{e.is_admin ? UI_SVG.crown(avatarInk(a11y), 17) : `${e.name?.[0] || \"\"}${(e.surname||\"\")[0]||\"\"}`.toUpperCase()}");
    expect(t).toContain("<FaceImg who={{ id: e.id }} />\n                        </span>\n                        <span data-emp-dot=\"\"");
    expect(t).toContain("width:11, height:11, borderRadius:\"50%\", background:st.color");
    // фото в строке касаний не ловит: строка открывает карточку, фото крупно — там
    const rowPart = t.slice(t.indexOf('<span data-emp-face=""'), t.indexOf('<span data-emp-dot=""'));
    expect(rowPart).not.toContain("zoom");
  });
});

describe("v162: мелочи", () => {
  it("три кнопки, что оставались залитыми цветом, — линзы", () => {
    expect(rd("ui/screens-team.jsx")).toContain('<button className="sa-btn sa-btn-pulse" data-lens-btn="main" onClick={submit}');
    expect(rd("ui/training-card.jsx")).toContain('<button className="sa-btn" data-lens-btn="main" onClick={doPrint} {...onActivate(doPrint)}');
    expect(rd("ui/screens-exam.jsx")).toContain('className="sa-btn" data-lens-btn="main" data-cert-sharepic=""');
  });
  it("экран входа тёмный в обеих темах — линза «Войти» на нём тёмная и в «Для чтения»", () => {
    const t = rd("ui/screens-team.jsx"), look = rd("ui/home-look.jsx");
    expect(t).toContain('minHeight:"calc(100vh - var(--sa-st, 0px))" }} className="sa-screen" data-lens-dark="">');
    expect(look).toContain("html.sa-lens.sa-light [data-lens-dark]{--lk-gold:#C8A96E;--lk-hi:#E8C983;");
    expect(look).toContain('html.sa-lens.sa-light [data-lens-dark] [data-lens-btn="main"]{background:radial-gradient(120% 160% at 50% 0%,rgba(232,201,131,0.24),rgba(200,169,110,0.12) 62%)!important;');
    expect(look).toContain('html.sa-lens.sa-light [data-lens-dark] [data-lens-btn="main"]::after{border-color:var(--lk-ring)}');
    // тёмные значения — те же, что у линзы тёмной темы
    const dark = /html\.sa-lens\{(--lk-gold:[^}]*?--lk-ring:rgba\(214,178,102,0\.44\))/.exec(look)[1].replace(/\s+/g, "");
    const mine = /html\.sa-lens\.sa-light \[data-lens-dark\]\{([^}]*)\}/.exec(look)[1].replace(/\s+/g, "");
    expect(mine).toBe(dark);
    // правило стоит после светлого — и точнее его
    expect(look.indexOf("html.sa-lens.sa-light [data-lens-dark] [data-lens-btn=\"main\"]{")).toBeGreaterThan(look.indexOf("html.sa-lens.sa-light [data-lens-btn=\"main\"]{"));
    expect(count(t, 'data-lens-dark=""')).toBe(1);
    // и подсказка в поле кода светлая: тёмная на тёмном поле была почти не видна
    const css = rd("ui/css.js");
    expect(css).toContain(".sa-light [data-lens-dark] input::placeholder { color: rgba(200, 180, 152, 0.65); opacity: 1; }");
    expect(css).toContain(".sa-light [data-lens-dark] input { caret-color: #C8A96E; }");
    expect(css.indexOf(".sa-light [data-lens-dark] input::placeholder")).toBeGreaterThan(css.indexOf(".sa-light input::placeholder, .sa-light textarea::placeholder"));
  });
  it("поле кода на «ты», как текст над ним; старые сценарии ищут поле по новой подписи", () => {
    const t = rd("ui/screens-team.jsx");
    expect(t).toContain('placeholder="Введи код"'); expect(t).not.toContain("Введите");
    expect(t).toContain("Введи код доступа от руководителя.");
    for (const f of ["tools/claude/e2e-v64.mjs", "tools/claude/e2e-v68.mjs"]) { const s = rd(f); expect(s).toContain('input[placeholder="Введи код"]'); expect(s).not.toContain("Введите код"); }
  });
  it("полоска «Первых шагов» заполняется слева направо: сколько шагов сделано", () => {
    const m = rd("ui/mastery.jsx");
    expect(m).toContain("{fw.items.map((it, i) => <span key={it.id} style={{ flex: 1, height: 5, borderRadius: 3, background: i < fw.done ? tierColor(3, a11y) : c.faint }} />)}");
    expect(m).not.toContain("background: it.done ? tierColor(3, a11y) : c.faint }} />)}");
  });
  it("сургучная печать — общая: её берёт и лист сертификата", () => {
    expect(rd("ui/now-hero.jsx")).toContain('export function WaxSeal({ size = 50, icon = "clock" }) {');
    expect(rd("ui/screens-exam.jsx")).toContain('import { WaxSeal } from "./now-hero";');
    expect(rd("ui/screens-exam.jsx")).toContain('<WaxSeal size={62} icon="gradcap" />');
  });
});

describe("v162: сборка, журнал, памятки", () => {
  it("«сборка v162» и новее; CHANGES — Дополнение 487 со словами владельца; проверки названы в памятке; гид знает про лист и лица", () => {
    const vers = readdirSync("tests").map((f) => /^v(\d+)\.test\.js$/.exec(f)).filter(Boolean).map((m) => +m[1]);
    const label = +/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1];
    expect(label).toBe(Math.max(...vers));
    expect(label).toBeGreaterThanOrEqual(162);
    const ch = rd("CHANGES.md");
    expect(ch).toMatch(/^# Дополнение 487 — [^\n]*\(v162\)$/m);
    const part = ch.slice(ch.indexOf("# Дополнение 487"));
    for (const w of ["«Берем все", "корешк", "Жизнь команды", "подиум", "Сертификат", "шире экрана", "картинкой", "Список сотрудников", "линз", "этап", "tests/v162.test.js", "e2e-v162.mjs"]) expect([w, part.includes(w)]).toEqual([w, true]);
    expect(rd("tools/claude/README.md")).toContain("e2e-v162.mjs");
    const g = rd("ui/guide.jsx");
    expect(g).toContain("«Поделиться картинкой» отправляет сам лист");
    expect(g).toContain("Лицо стоит и на карточках чата о человеке");
  });
});
