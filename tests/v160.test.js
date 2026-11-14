// v160 (Доп. 485): фото сотрудников — везде, где были буквы, и крупно по нажатию.
//
// Владелец: «И по фото сотрудников) Давай что бы везде было, дне инициалы, что бы каждый видел своего коллегу. И добавим
// возможность посмотреть профиль, имею ввиду по типу увеличить фото, а то в миниатюре ничего не видно😉».
//   1. Фото крупно: один слой на всё приложение (FaceViewer в App) — круг, имя, «должность · заведение».
//   2. Фото в кружках с буквами: чат, квест смены, «Спасибо от коллег», «Что дало обучение», «Новички», аналитика,
//      «Первая неделя», карточка сотрудника, «Аккаунт», «Моя статистика», разбор в рейтинге, «Сотрудник недели».
//   3. Рейтинг и «Лига недели»: у кого фото есть — лицо с номером места в углу; у остальных — прежний кружок.
//   4. Должность под фото — из списка фото (этап 52 отдаёт position).
// Вид в браузере (обе темы, 320 px, нажатия, «назад», сервер без этапа 52) — tools/claude/e2e-v160.mjs.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store0 = {};
globalThis.localStorage = { getItem: (k) => (k in store0 ? store0[k] : null), setItem: (k, v) => { store0[k] = String(v); }, removeItem: (k) => { delete store0[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { setPhotoBackend, memoryBackend } from "../lib/photo-store";
import {
  normStaffPhotos, staffPhotoOf, loadStaffPhotos, staffThumbUrl, _resetStaffPhotos,
  showFace, hideFace, faceNow, faceSubscribe, faceName, faceSubline,
} from "../lib/staff-photo";
import { FaceImg, FaceZoomHint, FaceChip, CrownFace, FaceOver, RankFace, FaceViewer, FaceView } from "../ui/staff-photo";
import { Avatar } from "../ui/analytics-kit";
import { ShiftHero, TeamHero } from "../ui/home-hubs";
import { WeekStar, LeaderboardScreen } from "../ui/screens-gamification";
import { POSITION_LABEL } from "../data/positions";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const count = (s, part) => s.split(part).length - 1;
const noop = () => {};

// ── сервер в памяти (тот же, что в демо) и «телефон» ────────────────────────────────────────────────
const R0 = "Два моря, Океан", R1 = "Порт";
const PEOPLE = [
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-darya", name: "Дарья", surname: "Лебедева", restaurant: R0, position: "Waiter", is_admin: false },
  { id: "e-ivan", name: "Иван", surname: "Петров", restaurant: R1, position: "bartender", is_admin: false },
];
const TOK = { tr: "u-roman", tm: "u-maria", ta: "e-anna", td: "e-darya", ti: "e-ivan" };
const b64 = (s, n) => s.repeat(n);
const F1 = b64("QUJD", 40), T1 = b64("REVG", 12), F2 = b64("R0hJ", 44), T2 = b64("SktM", 12), F3 = b64("TU5P", 48), T3 = b64("UFFS", 12);
const url = (x) => "data:image/jpeg;base64," + x;
const SEED = { "u-maria": { full: F1, thumb: T1 }, "e-darya": { full: F2, thumb: T2 }, "e-ivan": { full: F3, thumb: T3 } };
const mk = (x = {}) => makeServer({ today: "2026-11-14", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, ...x });
const realFetch = globalThis.fetch, realLS = globalThis.localStorage;
const useServer = (srv) => { globalThis.fetch = async (u, init = {}) => ({ ok: true, status: 200, json: async () => srv.rpc(String(u).split("/rpc/")[1], JSON.parse(init.body || "{}")) }); };
const phone = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; };
const login = (tok) => globalThis.localStorage.setItem("sa_session_token", tok);
const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false };
const ANNA = PEOPLE[2], ROMAN = PEOPLE[0];
// список и превью — в память, как после входа: кружки рисуются с фото сразу
const enter = async (tok = "ta", opts = {}) => {
  globalThis.localStorage = phone(); setPhotoBackend(memoryBackend()); _resetStaffPhotos();
  useServer(mk({ staffPhotos: SEED, ...opts })); login(tok);
  const list = await loadStaffPhotos();
  await Promise.all(list.items.map((x) => staffThumbUrl(x.id, x.ver)));
  return list;
};
const leave = () => { globalThis.fetch = realFetch; globalThis.localStorage = realLS; setPhotoBackend(null); _resetStaffPhotos(); };

describe("v160: что открыто крупно — одна шина на всё приложение (lib/staff-photo.js)", () => {
  const raw = { ok: true, me: "e-anna", restaurant: R0, can: {}, items: [
    { id: "u-maria", name: " Мария ", surname: "Ким", restaurant: R0, position: "Manager", ver: "aaa" },
    { id: "e-old", name: "Олег", surname: "", restaurant: R0, ver: "bbb" },                      // сервер без v160: должности нет
    { id: "e-odd", name: "Нина", surname: "Сом", restaurant: "", position: "sommelier", ver: "ccc" },   // должности нет в словаре
  ] };
  const list = normStaffPhotos(raw);
  beforeEach(() => { _resetStaffPhotos(); });
  it("список фото несёт должность строчными; сервер её не отдал — пусто, остальное как было", () => {
    expect(list.byId["u-maria"].pos).toBe("manager");
    expect(list.byId["e-old"].pos).toBe("");
    expect(list.byId["e-odd"].pos).toBe("sommelier");
    expect(Object.keys(list.byId["u-maria"]).sort()).toEqual(["id", "name", "pos", "restaurant", "surname", "tok", "ver"]);
    expect(staffPhotoOf(list, { full: "Ким Мария" }).id).toBe("u-maria");
  });
  it("showFace: имя, заведение и подпись; экран подпись не дал — должность из списка; подписчики узнают", () => {
    const seen = [];
    const off = faceSubscribe((v) => seen.push(v ? v.id + "|" + v.sub : null));
    expect(faceNow()).toBe(null);
    expect(showFace(list.byId["u-maria"])).toBe(true);
    expect(faceNow()).toEqual({ id: "u-maria", ver: "aaa", name: "Мария Ким", restaurant: R0, sub: "Менеджер" });
    expect(showFace(list.byId["u-maria"], " Старший смены ")).toBe(true);
    expect(faceNow().sub).toBe("Старший смены");
    expect(showFace(list.byId["e-old"])).toBe(true);
    expect(faceNow()).toEqual({ id: "e-old", ver: "bbb", name: "Олег", restaurant: R0, sub: "" });
    showFace(list.byId["e-odd"]);
    expect(faceNow().sub).toBe("");                                              // нет в словаре — код должности не показываем
    hideFace();
    expect(faceNow()).toBe(null);
    hideFace();                                                                  // второй раз — тихо, подписчиков не дёргаем
    expect(seen).toEqual(["u-maria|Менеджер", "u-maria|Старший смены", "e-old|", "e-odd|", null]);
    off();
    showFace(list.byId["u-maria"]);
    expect(seen.length).toBe(5);                                                 // отписался — больше не слышит
  });
  it("нечего показывать — не открываем: нет записи, номера или версии фото", () => {
    expect(showFace(null)).toBe(false);
    expect(showFace({ id: "", ver: "x" })).toBe(false);
    expect(showFace({ id: "e-1", ver: "" })).toBe(false);
    expect(faceNow()).toBe(null);
  });
  it("строка под именем: «должность · заведение», что известно; имя — «Имя Фамилия» без лишних пробелов", () => {
    expect(faceSubline({ sub: "Бармен", restaurant: R0 })).toBe("Бармен · " + R0);
    expect(faceSubline({ sub: "", restaurant: R0 })).toBe(R0);
    expect(faceSubline({ sub: "Бармен", restaurant: "" })).toBe("Бармен");
    expect(faceSubline({ sub: "", restaurant: "" })).toBe("");
    expect(faceSubline(null)).toBe("");
    expect(faceName({ name: " Мария ", surname: " Ким " })).toBe("Мария Ким");
    expect(faceName({ name: "Роман", surname: "" })).toBe("Роман");
    expect(faceName(null)).toBe("");
    expect(POSITION_LABEL.manager).toBe("Менеджер");
  });
  it("сброс для проверок закрывает слой и забывает подписчиков", () => {
    const seen = [];
    faceSubscribe((v) => seen.push(v));
    showFace(list.byId["u-maria"]);
    _resetStaffPhotos();
    expect(faceNow()).toBe(null);
    showFace(list.byId["u-maria"]);
    expect(seen.length).toBe(1);
  });
});

describe("v160: лицо в кружке — по нажатию крупно (ui/staff-photo.jsx)", () => {
  let list;
  beforeAll(async () => { list = await enter("ta"); });
  afterAll(leave);
  it("FaceImg zoom: кнопка с подписью «Фото крупно: имя», ловит касание; без zoom — как в v158 (касаний не ловит)", () => {
    const z = R(h(FaceImg, { who: { id: "u-maria" }, zoom: true, sub: "Менеджер" }));
    expect(z).toContain('<img data-face="u-maria" data-face-zoom="" src="' + url(T1) + '"');
    expect(z).toContain('role="button" tabindex="0" aria-label="Фото крупно: Мария Ким"');
    expect(z).toContain("pointer-events:auto");
    expect(z).toContain("cursor:zoom-in");
    expect(z).toContain("border-radius:inherit");
    const plain = R(h(FaceImg, { who: { id: "u-maria" } }));
    expect(plain).toContain('<img data-face="u-maria" src="' + url(T1) + '"');
    expect(plain).not.toContain("data-face-zoom");
    expect(plain).not.toContain("role=");
    expect(plain).toContain("pointer-events:none");
    expect(R(h(FaceImg, { who: { id: "e-anna" }, zoom: true }))).toBe("");            // фото нет — ничего, остаются буквы
  });
  it("FaceImg zoom quiet: в кружке, скрытом от чтения с экрана, и внутри карточки-кнопки — касанием, но не кнопкой", () => {
    const q = R(h(FaceImg, { who: { id: "e-darya" }, zoom: true, quiet: true }));
    expect(q).toContain('<img data-face="e-darya" data-face-zoom="quiet"');
    expect(q).toContain("pointer-events:auto");
    expect(q).not.toContain("role=");
    expect(q).not.toContain("tabindex");
    expect(q).not.toContain("aria-label");
    expect(R(h(FaceImg, { who: { id: "e-darya" }, quiet: true }))).not.toContain("data-face-zoom");   // quiet без zoom ничего не значит
  });
  it("FaceZoomHint, FaceChip, CrownFace — только когда фото есть", () => {
    expect(R(h(FaceZoomHint, { who: { id: "u-maria" } }))).toMatch(/^<span data-face-hint="" aria-hidden="true" style="[^"]*pointer-events:none[^"]*"><svg /);
    expect(R(h(FaceZoomHint, { who: { id: "e-anna" } }))).toBe("");
    const chip = R(h(FaceChip, { who: { full: "Лебедева Дарья" }, size: 34, sub: "Официант" }));
    expect(chip).toMatch(/^<span data-face-chip="e-darya" style="[^"]*width:34px;height:34px[^"]*"><img data-face="e-darya" data-face-zoom="" /);
    expect(chip).toContain('aria-label="Фото крупно: Дарья Лебедева"');
    expect(chip).toContain("data-face-hint");
    expect(R(h(FaceChip, { who: { full: "Лебедева Дарья" }, hint: false }))).not.toContain("data-face-hint");
    expect(R(h(FaceChip, { who: { full: "Смирнова Анна" } }))).toBe("");
    const crown = R(h(CrownFace, { who: { name: "Мария", surname: "Ким", restaurant: R0 }, sub: "Сотрудник недели" }));
    expect(crown).toMatch(/^<img data-face="u-maria" data-face-zoom="" [^>]*\/><span data-face-crown="" aria-hidden="true"/);
    expect(R(h(CrownFace, { who: { name: "Анна", surname: "Смирнова", restaurant: R0 } }))).toBe("");
  });
  it("FaceOver: фото поверх готового кружка; нет фото — кружок как был", () => {
    const disc = h("i", { "data-disc": "" }, "ДЛ");
    const on = R(h(FaceOver, { who: { id: "e-darya" }, zoom: true }, disc));
    expect(on).toMatch(/^<span data-face-over="" style="position:relative;display:inline-grid;flex-shrink:0;border-radius:50%"><i data-disc="">ДЛ<\/i><img data-face="e-darya" data-face-zoom="" /);
    expect(R(h(FaceOver, { who: { id: "e-darya" }, zoom: true, quiet: true }, disc))).toContain('data-face-zoom="quiet"');
    expect(R(h(FaceOver, { who: { id: "e-darya" } }, disc))).not.toContain("data-face-zoom");
    expect(R(h(FaceOver, { who: { id: "e-anna" }, zoom: true }, disc))).toBe('<span data-face-over="" style="position:relative;display:inline-grid;flex-shrink:0;border-radius:50%"><i data-disc="">ДЛ</i></span>');
  });
  it("RankFace: лицо с номером места в углу и ободком медали; нет фото — прежний кружок с номером", () => {
    const old = h("div", { "data-old": "" }, "1");
    const on = R(h(RankFace, { who: { id: "e-darya" }, n: 1, medal: "#F0CE72" }, old));
    expect(on).toMatch(/^<span data-rank-face="e-darya" style="position:relative;width:38px;height:38px;[^"]*box-shadow:0 0 0 1.5px #F0CE72"><img data-face="e-darya" src=/);
    expect(on).not.toContain("data-face-zoom");                                  // в рейтинге строка открывает разбор
    expect(on).not.toContain("data-old");
    expect(on).toMatch(/<b data-rank-n="" style="[^"]*font-size:10.5px[^"]*color:#2A1F0A;background:#F0CE72[^"]*">1<\/b>/);
    const dark = R(h(RankFace, { who: { id: "e-darya" }, n: 3, medal: "#8A5630" }, old));
    expect(dark).toMatch(/<b data-rank-n="" style="[^"]*color:#FFF8E8;background:#8A5630[^"]*">3<\/b>/);   // на тёмной медали цифра светлая
    const plain = R(h(RankFace, { who: { id: "e-darya" }, n: 12, zoom: true, sub: "Официант" }, old));
    expect(plain).toContain('data-face-zoom=""');                                // в лиге строка ничего не открывает — фото крупно из неё
    expect(plain).toMatch(/<b data-rank-n="" style="[^"]*min-width:18px[^"]*color:#F3E7CC;background:#2B2114[^"]*">12<\/b>/);
    expect(R(h(RankFace, { who: { id: "e-darya" }, n: 4, a11y: true }, old))).toMatch(/color:#3A2A0E;background:#F4E9CF/);
    expect(R(h(RankFace, { who: { id: "e-anna" }, n: 2, medal: "#D2D7DE" }, old))).toBe('<div data-old="">1</div>');
    expect(R(h(RankFace, { who: null, n: 2 }, old))).toBe('<div data-old="">1</div>');
    expect(R(h(RankFace, { who: null, n: 2 }))).toBe("");
  });
  it("слой «фото крупно»: диалог с именем и «должность · заведение», крестик закрывает и по «назад» Telegram", () => {
    const ver = list.byId["u-maria"].ver;
    const html = R(h(FaceView, { view: { id: "u-maria", ver, name: "Мария Ким", restaurant: R0, sub: "Менеджер" } }));
    expect(html).toMatch(/^<div data-face-view="u-maria" role="dialog" aria-modal="true" aria-label="Фото: Мария Ким" style="position:fixed;inset:0;z-index:9700;/);
    expect(html).toContain('<button type="button" data-sa-back="" data-face-x="" aria-label="Закрыть"');
    expect(html).toMatch(/width:44px;height:44px/);
    expect(html).toContain('data-face-photo="thumb"');                           // сначала превью из кружка, фото целиком — следом
    expect(html).toContain('<img src="' + url(T1) + '"');
    expect(html).toContain("width:min(82vw, 54vh, 380px)");
    expect(html).toMatch(/<div data-face-name="" style="[^"]*font-size:22px[^"]*">Мария Ким<\/div>/);
    expect(html).toMatch(/<div data-face-sub="" style="[^"]*font-size:14px[^"]*">Менеджер · Два моря, Океан<\/div>/);
    const bare = R(h(FaceView, { view: { id: "u-maria", ver, name: "Мария Ким", restaurant: "", sub: "" } }));
    expect(bare).not.toContain("data-face-sub");
    expect(R(h(FaceViewer))).toBe("");                                           // ничего не открыто — слоя нет
  });
  it("слой стоит в приложении один раз, поверх чата и листов", () => {
    const app = rd("App.jsx");
    expect(app).toContain('import { MyFaceLayer, FaceViewer } from "./ui/staff-photo";');
    expect(count(app, "<FaceViewer />")).toBe(1);
    const sp = rd("ui/staff-photo.jsx");
    expect(sp).toContain("return createPortal(<FaceView key={view.id} view={view} />, document.body);");
    expect(sp).toContain('if (ev.key === "Escape") { ev.stopPropagation(); ev.stopImmediatePropagation(); hideFace(); }');
    expect(sp).toContain('window.addEventListener("keydown", key, true);');
    expect(sp).toContain('window.removeEventListener("keydown", key, true);');
    expect(sp).toContain("React.useEffect(() => { if (known && !live) hideFace(); }, [known, live]);");
    expect(sp).toContain("staffFullUrl(view.id, ver).then((u) => { if (on && u) setFull(u); })");
  });
});

describe("v160: фото в кружках, где были буквы", () => {
  beforeAll(async () => { await enter("ta"); });
  afterAll(leave);
  it("«Смена» и «Команда» на главной: лица открываются крупно касанием (карточка остаётся кнопкой)", () => {
    const crew = { mates: [{ id: 1, full: "Ким Мария", first: "Мария", ini: "МК", lead: true, same: true }, { id: 6, full: "Лебедева Дарья", first: "Дарья", ini: "ДЛ", lead: false, same: true },
      { id: 8, full: "Смирнова Анна", first: "Анна", ini: "АС", lead: false, same: true }], lead: "Мария", leadF: true, leadMe: false };
    const html = R(h(ShiftHero, { a11y: false, shift: { off: false, label: "День · 12:00–20:00" }, mates: crew }));
    expect(html).toMatch(/data-mate="lead"[^>]*>МК<img data-face="u-maria" data-face-zoom="quiet"/);
    expect(html).toMatch(/data-mate="one"[^>]*>ДЛ<img data-face="e-darya" data-face-zoom="quiet"/);
    expect(html).toMatch(/data-mate="one"[^>]*>АС<\/span>/);
    const lb = [{ name: "Мария", surname: "Ким", restaurant: R0, avg: 100 }, { name: "Анна", surname: "Смирнова", restaurant: R0, avg: 92 }, { name: "Дарья", surname: "Лебедева", restaurant: R0, avg: 83 }];
    const team = R(h(TeamHero, { a11y: false, leaderboard: lb, profile: ANNA, onOpen: noop }));
    expect(count(team, 'data-face-zoom="quiet"')).toBe(2);
    expect(team).not.toContain('data-face-zoom=""');
    const hubs = rd("ui/home-hubs.jsx");
    expect(hubs).toContain('{text}{who && !more ? <FaceImg who={who} zoom={zoom} quiet sub={lead ? "Старший смены" : ""} /> : null}</span>');
    expect(hubs).toContain("<MateDisc key={m.id} a11y={a11y} text={m.ini} lead={m.lead} who={{ full: m.full }} zoom />");
  });
  it("аналитика: кружок сотрудника ищет фото по имени в его заведении; в строке со своим нажатием — без «крупно»", () => {
    const a = R(h(Avatar, { who: "Дарья Лебедева", rest: R0, a11y: false }));
    expect(a).toMatch(/>ДЛ<img data-face="e-darya" data-face-zoom="" /);
    expect(R(h(Avatar, { who: "Дарья Лебедева", rest: R0, a11y: false, zoom: false }))).toMatch(/>ДЛ<img data-face="e-darya" src=/);
    expect(R(h(Avatar, { who: "Иван Петров", rest: R1, a11y: false }))).toContain('data-face="e-ivan"');
    expect(R(h(Avatar, { who: "Иван Петров", rest: R0, a11y: false }))).not.toContain("data-face");   // в «Океане» такого нет
    expect(R(h(Avatar, { who: "Анна Смирнова", rest: R0, a11y: false }))).not.toContain("data-face");
    const adm = rd("ui/screens-admin.jsx");
    expect(adm).toContain("<Avatar who={p.who} rest={p.restaurant} tone={tone} a11y={a11y} zoom={false} />");   // строка раскрывает вопросы
    expect(adm).toContain("<Avatar who={p.who} rest={rest} size={30} a11y={a11y} />");
    expect(adm).toContain("<Avatar who={p.who} rest={p.restaurant} a11y={a11y} />");
    expect(adm).toContain('<Avatar who={`${p.name} ${p.surname || ""}`} rest={p.restaurant} size={24} tone="mid" a11y={a11y} />');
    expect(adm).toContain("<FaceImg who={{ name: h.name, surname: h.surname, restaurant: h.restaurant }} zoom />");   // «Первая неделя» → «Новички»
    const gm = rd("ui/screens-gamification.jsx");
    expect(gm).toContain('<Avatar who={`${p.name} ${p.surname}`} rest={p.restaurant} size={38} tone={tone === "good" ? null : tone} a11y={a11y} zoom={false} />');   // строку тянут пальцем
    expect(gm).toContain('<Avatar who={`${p.name} ${p.surname}`} rest={p.restaurant} size={40} tone={stat.tests === 0 ? "bad" : null} a11y={a11y} />');
  });
  it("«Сотрудник недели»: есть фото — оно в медали под маленькой короной; нет — медаль с короной, как была", () => {
    const withFace = R(h(WeekStar, { T, weekly: [{ name: "Дарья", surname: "Лебедева", restaurant: R0, pts: 20 }, { name: "Анна", surname: "Смирнова", restaurant: R0, pts: 12 }] }));
    expect(withFace).toMatch(/<div data-lens="avatar" style="width:46px;height:46px;border-radius:50%;[^"]*position:relative"><svg[\s\S]*?<\/svg><img data-face="e-darya" data-face-zoom="" /);
    expect(withFace).toContain('aria-label="Фото крупно: Дарья Лебедева"');
    expect(count(withFace, "data-face-crown")).toBe(1);
    const noFace = R(h(WeekStar, { T, weekly: [{ name: "Анна", surname: "Смирнова", restaurant: R0, pts: 12 }] }));
    expect(noFace).not.toContain("data-face");
    expect(noFace).toMatch(/<div data-lens="avatar" style="width:46px;height:46px;border-radius:50%;[^"]*"><svg/);
  });
  it("чат: фото в личных чатах, поиске, списках людей и упоминаниях; крупно — из карточки коллеги, участников и «спасибо»", () => {
    const c = rd("ui/chat.jsx");
    expect(c).toContain('import { FaceImg, FaceZoomHint } from "./staff-photo";');
    expect(c).toContain('{chatInitials(c && c.peer ? c.peer.name : "")}{c && c.peer ? <FaceImg who={{ id: c.peer.id }} /> : null}</span>);');
    expect(c).toContain("{chatInitials(m.name)}{m.emp != null ? <FaceImg who={{ id: m.emp }} /> : null}</span>}");
    expect(c).toContain('<span className="ch-ava" aria-hidden="true">{chatInitials(p.name)}<FaceImg who={{ id: p.id }} /></span>');        // выбор человека: строка выбирает
    expect(c).toContain('{it.kind === "person" ? <FaceImg who={{ id: it.id }} /> : null}');
    expect(c).toContain('<span className="ch-ava" data-chat-person-face=""><span aria-hidden="true">{p ? chatInitials(p.name) : ""}</span><FaceImg who={{ id: emp }} zoom sub={p ? posName(p.pos) : ""} /><FaceZoomHint who={{ id: emp }} /></span>');
    expect(c).toContain('<span className="ch-ava" aria-hidden="true">{chatInitials(p.name)}<FaceImg who={{ id: p.id }} zoom quiet sub={posName(p.pos)} /></span>');
    expect(c).toContain('<span className="ch-ava" aria-hidden="true">{chatInitials(to.name)}<FaceImg who={{ id: to.id }} zoom quiet sub={posName(to.pos)} /></span>');
    // кружки общих чатов — как были (их держат tests/v92 и v103)
    expect(c).toContain('? <span className={"ch-ava team" + (big ? " big" : "")} aria-hidden="true">{chatInitials(c.title || "Чат")}</span>');
    expect(count(c, "<FaceImg ")).toBe(7);
  });
  it("квест смены: фото в стопке кружков и в жетонах «Кто в смене»; жетон с фото открывает его крупно целиком", () => {
    const t = rd("ui/together.jsx");
    expect(t).toContain("const e = useFace({ id: p.id });");
    expect(t).toContain('showFace(e, POSITION_LABEL[p.position] || "");');
    expect(t).toContain('role={e ? "button" : undefined} tabIndex={e ? 0 : undefined} onClick={open}');
    expect(t).toContain('{(p.name || "?")[0]}<FaceImg who={{ id: p.id }} /></span>{p.me ? "ты" : short(p)}');
    expect(t).toContain("{people.map((p, i) => <QuestPerson key={p.id} p={p} color={pal[p.me ? 0 : (i % (pal.length - 1)) + 1]} />)}");
    expect(t).toMatch(/\.tg-who \.avs span\{position:relative;/);
    expect(t).toMatch(/\.tg-p \.av\{[^}]*position:relative/);
  });
  it("«Спасибо от коллег», «Что дало обучение», «Новички»: фото поверх кружка с буквой", () => {
    expect(rd("ui/peer-thanks.jsx")).toContain("<FaceOver who={{ id: x.from }} zoom quiet><Ava name={x.name} /></FaceOver>");
    const g = rd("ui/gain.jsx");
    expect(g).toContain("{ava ? <FaceOver who={{ id: face }} zoom><Ava name={ava} /></FaceOver> : null}");
    expect(count(g, "face: g.id, ava: g.n")).toBe(1);
    expect(count(g, "face: x.id, ava: x.n")).toBe(1);
    const n = rd("ui/newbie.jsx");
    expect(n).toContain("<FaceOver who={{ id: nb.buddy.id }} zoom sub={upFirst(posWord(nb.buddy.pos))}><Ava name={nb.buddy.name} c={c} /></FaceOver>");
    expect(n).toContain("{r.name ? <FaceOver who={{ id: r.key }}><Ava name={r.name} c={c} size={32} /></FaceOver> : null}");   // выбор человека: строка выбирает
    expect(n).toContain("<FaceOver who={{ id: n.emp }} zoom quiet sub={upFirst(posWord(n.pos))}><Ava name={n.name} c={c} /></FaceOver>");
  });
  it("карточка сотрудника у владельца, «Аккаунт» и «Моя статистика»: фото по номеру сотрудника, открывается крупно", () => {
    const t = rd("ui/screens-team.jsx");
    expect(t).toContain("<FaceImg who={{ id: selected.id }} zoom sub={positionLabel(selected.position)} />");
    expect(t).toContain("{profile ? <FaceImg who={{ id: profile.id }} zoom sub={positionLabel(profile.position)} /> : null}");
    const g = rd("ui/screens-gamification.jsx");
    expect(g).toContain("{profile ? <FaceImg who={{ id: profile.id }} zoom /> : null}");
  });
  it("«График»: фото в прежних пяти кружках, а в строке выбранного человека — отдельным кружком, который открывается крупно", () => {
    const s = rd("ui/schedule.jsx");
    expect(count(s, "<FaceImg who={{ full: ")).toBe(5);                           // как держит tests/v158
    expect(s).toContain('<FaceImg who={{ full: s.name }} zoom quiet sub={posName(s.pos)} />');
    expect(s).toContain("<FaceChip who={{ full: callW.name }} size={34} sub={posName(callW.pos)} />");
    expect(s).toContain("<FaceChip who={{ full: w.name }} size={34} sub={posName(w.pos)} />");
    // «Сегодня»: телефона в графике нет, а фото есть — карточка всё равно нажимается, строка под сеткой есть
    expect(s).toContain("const canTap = !!c.who.phone || !!staffPhotoOf(knownPeople, { full: c.who.name });");
    expect(s).toContain("if (!w || !(w.phone || staffPhotoOf(knownPeople, { full: w.name }))) return null;");
    expect(s).toContain('</a> : <span style={{ flexShrink:0, fontSize:12, color:P.sub }}>телефона нет в графике</span>}');
  });
});

describe("v160: рейтинг и «Лига недели» — лицо с номером места", () => {
  const lb = [
    { name: "Дарья", surname: "Лебедева", restaurant: R0, position: "waiter", role: "core", avg: 96, total: 4 },
    { name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", role: "core", avg: 90, total: 3 },
    { name: "Иван", surname: "Петров", restaurant: R1, position: "waiter", role: "core", avg: 80, total: 2 },
  ];
  const board = (profile, extra = {}) => R(h(LeaderboardScreen, { T, leaderboard: lb, scores: [], profile, onBack: noop, ...extra }));
  beforeAll(async () => { await enter("ta"); });
  afterAll(leave);
  beforeEach(() => { globalThis.localStorage.removeItem("sa_lb_scope"); });
  it("своё заведение: у Дарьи фото с золотой «1», у Анны фото нет — прежний кружок «2»; колонка одной ширины", () => {
    const html = board(ANNA);
    expect(count(html, "data-rank-face=")).toBe(1);
    expect(html).toMatch(/<div data-lb-rank="" style="flex-shrink:0;min-width:38px;[^"]*"><span data-rank-face="e-darya" [^>]*box-shadow:0 0 0 1.5px #F0CE72"><img data-face="e-darya" src=/);
    expect(html).toMatch(/<b data-rank-n="" [^>]*>1<\/b>/);
    expect(html).toMatch(/<div data-lb-rank="" style="flex-shrink:0;min-width:38px;[^"]*"><div style="width:27px;height:27px;[^"]*">2<\/div><\/div>/);
    expect(html).not.toContain("data-face-zoom");                                // строка открывает разбор, фото крупно — там
    expect(html).not.toContain("Иван");
  });
  it("вся сеть: у коллеги из чужого заведения фамилия одной буквой — и фото не показываем; владельцу видно всё", () => {
    globalThis.localStorage.setItem("sa_lb_scope", "net");
    const mine = board(ANNA);
    expect(mine).toContain("Иван П.");
    expect(mine).not.toContain("Петров");
    expect(count(mine, "data-rank-face=")).toBe(1);
    expect(mine).not.toContain('data-face="e-ivan"');
    const boss = board(ROMAN);
    expect(boss).toContain("Иван Петров");
    expect(boss).toMatch(/<span data-rank-face="e-ivan" [^>]*box-shadow:0 0 0 1.5px #D6A06A">/);
    expect(count(boss, "data-rank-face=")).toBe(2);
  });
  it("ни у кого в списке фото нет — рейтинг как раньше, колонка прежней ширины", () => {
    const html = R(h(LeaderboardScreen, { T, leaderboard: [lb[1]], scores: [], profile: ANNA, onBack: noop }));
    expect(html).not.toContain("data-rank-face");
    expect(html).toMatch(/<div data-lb-rank="" style="flex-shrink:0;min-width:28px;/);
  });
  it("вид «Для чтения»: медали темнее — светлая «2» на светлой карточке читается", () => {
    const html = R(h(LeaderboardScreen, { T: { ...T, a11y: true }, leaderboard: lb, scores: [], profile: ANNA, onBack: noop }));
    expect(html).toMatch(/border:1.5px solid #5F687099;color:#5F6870;[^"]*">2<\/div>/);
    expect(html).toMatch(/<span data-rank-face="e-darya" [^>]*box-shadow:0 0 0 1.5px #8A6A1E">/);
    expect(html).toMatch(/<b data-rank-n="" style="[^"]*color:#FFF8E8;background:#8A6A1E[^"]*">1<\/b>/);
  });
  it("разбор человека в рейтинге: фото поверх букв, значок «увеличить», открывается крупно", () => {
    const g = rd("ui/screens-gamification.jsx");
    expect(g).toContain('const faceOf = (p) => (p && shownSurname(p) === (p.surname || "") ? { name: p.name, surname: p.surname, restaurant: p.restaurant } : null);');
    expect(g).toContain("{selected ? <><FaceImg who={faceOf(selected)} zoom /><FaceZoomHint who={faceOf(selected)} /></> : null}");
    expect(g).toContain("const anyFace = filtered.some((p) => !!staffPhotoOf(faceList, faceOf(p)));");
    expect(g).toContain('<RankFace who={faceOf(p)} n={i+1} medal={med ? med[0] : ""} a11y={!!T.a11y}>');
  });
  it("«Лига недели»: фото у своих (чужим сервер отдаёт фамилию одной буквой), строка открывает фото крупно", () => {
    const l = rd("ui/league.jsx");
    expect(l).toContain('const faceOf = (r) => (r && (r.me || (!!myRest && (r.restaurant || "") === myRest)) ? { id: r.id } : null);');
    expect(l).toContain("const anyFace = sorted.slice(0, 100).some((r) => !!staffPhotoOf(faceList, faceOf(r)));");
    expect(l).toContain('<RankFace who={faceOf(r)} n={i + 1} medal={med || ""} a11y={a11y} zoom sub={POSITION_LABEL[r.position] || ""}>');
    expect(l).toContain('<div data-lg-rank="" style={{ flexShrink: 0, minWidth: anyFace ? 38 : 27,');
    // сервер и правда сокращает фамилию чужим — на этом держится правило
    expect(rd("supabase/supabase-stage25-live.sql")).toContain("'surname', case when t.v->>'restaurant' is not distinct from myrest then t.v->>'surname'");
  });
});

describe("v160: сервер отдаёт должность в списке фото (этап 52)", () => {
  afterAll(leave);
  it("SQL: position строчными в staff_photos; повторный запуск фото не стирает", () => {
    const q = rd("supabase/supabase-stage52-staff-photos.sql");
    expect(q).toContain("'restaurant', coalesce(e.restaurant, ''), 'position', lower(coalesce(e.position, '')), 'ver', p.ver, 'at', p.updated_at)");
    expect(q).toContain("v160");
    expect(q).not.toMatch(/drop table|truncate/i);
    expect(rd("supabase/README.md")).toMatch(/v160[^\n]*должност/i);
    expect(rd("tools/claude/sql/test52.sh")).toContain("position");
  });
  it("сервер в памяти (демо) отдаёт то же; флажок __demo_nopos — сервер, где этап 52 ещё прежний", async () => {
    const list = await enter("ta");
    expect(list.byId["u-maria"].pos).toBe("manager");
    expect(list.byId["e-darya"].pos).toBe("waiter");                              // в базе «Waiter» — приводим к строчным
    showFace(list.byId["e-ivan"]);
    expect(faceSubline(faceNow())).toBe("Бармен · Порт");
    const old = await enter("ta", { noPhotoPos: true });
    expect(old.byId["u-maria"].pos).toBe("");
    showFace(old.byId["u-maria"]);
    expect(faceSubline(faceNow())).toBe(R0);                                      // должности нет — под именем только заведение
    const boot = rd("tools/claude/demo-app/boot.js");
    expect(boot).toContain('noPhotoPos: lsGet("__demo_nopos") === "1"');
    expect(boot).toContain('keep.add("__demo_nopos");');
  });
});

describe("v160: сборка, журнал, памятки", () => {
  it("«сборка v160» и новее; CHANGES — Дополнение 485 со словами владельца; проверки названы в памятке", () => {
    const vers = readdirSync("tests").map((f) => /^v(\d+)\.test\.js$/.exec(f)).filter(Boolean).map((m) => +m[1]);
    const label = +/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1];
    expect(label).toBe(Math.max(...vers));
    expect(label).toBeGreaterThanOrEqual(160);
    const ch = rd("CHANGES.md");
    expect(ch).toMatch(/^# Дополнение 485 — [^\n]*\(v160\)$/m);
    const part = ch.slice(ch.indexOf("# Дополнение 485"));
    expect(part).toContain("что бы каждый видел своего коллегу");
    expect(part).toContain("а то в миниатюре ничего не видно");
    for (const w of ["крупно", "Рейтинг", "Лига недели", "этап 52", "tests/v160.test.js", "e2e-v160.mjs"]) expect([w, part.includes(w)]).toEqual([w, true]);
    const rm = rd("tools/claude/README.md");
    expect(rm).toContain("e2e-v160.mjs");
    expect(rm).toContain("__demo_nopos");
  });
  it("новые подписи — без тире между словами и не мельче 10,5 px", () => {
    const sp = rd("ui/staff-photo.jsx");
    const part = sp.slice(sp.indexOf("export function FaceImg"), sp.indexOf("export function MyFaceLayer"));
    expect(part).not.toMatch(/fontSize: ?(8|8\.5|9|9\.5|10)(?![.\d])/);
    expect(part).toContain('aria-label={"Фото крупно: " + faceName(e)}');
    expect(part).toContain('aria-label={"Фото: " + view.name}');
    expect(part).not.toMatch(/"[^"\n]*[А-Яа-яё] — [А-Яа-яё][^"\n]*"/);
  });
});
