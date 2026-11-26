// v199 (Доп. 524): у каждого заведения своя статистика, руководство сети смотрит по заведениям. Владелец (26.11): «я не
// хочу, что бы что-то перекликалось и у каждого заведения была своя статистика. Но, руководитель всей сети мог по
// заведениям увидеть статистику, а вот руководитель конкретного заведения, к примеру управляющий, только то, за которым
// он прикреплен». Решили: рейтинг и лига у сотрудника — только своё заведение; после перевода прежние результаты
// остаются в старом заведении; у человека одно основное заведение.
//   1. Сервер — этап 62 (supabase/supabase-stage62-venue-walls.sql, проверка tools/claude/sql/test62.sh): стены между
//      заведениями (тесты, лига, бот, фото, меню, график) и взгляд сети (org_view, quiz_hard_questions_at);
//   2. lib/org-model.js — кто сеть, какое заведение показать, тексты, вкладки меню; lib/org.js — общий выбор заведения
//      (useLens) и запрос так, как его видит руководитель заведения (viewRpc → org_view);
//   3. ui/venue-lens.jsx — лента заведений; аналитика, отчёты, итог месяца, новички, собеседование, график — с ней;
//      меню, рейтинг, лига и брифинг у сотрудника и менеджера — своё заведение;
//   4. сервер демо — этап 62 по тем же правилам (__demo_net, __demo_no62); «Сервер» знает этап 62.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v199.mjs.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { isNetwork, lensOf, lensErr, inLens, menuVenues, LENS_ALL, normOrg, orgFallback } from "../lib/org-model.js";
import { lensFor, viewRpc, setLens, _resetOrg, LENS_KEY } from "../lib/org.js";
import { rpcMissing } from "../api/supabase";
import { VenueLens, LensNote } from "../ui/venue-lens.jsx";
import { LeaderboardScreen } from "../ui/screens-gamification.jsx";
import { GainScreen } from "../ui/gain.jsx";
import { NewbiesScreen } from "../ui/newbie.jsx";
import { STAGES } from "../lib/server-check.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const R0 = "Два моря, Океан", PORT = "Порт";
const PEOPLE = [
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
  { id: "u-lena", name: "Елена", surname: "Сетевая", restaurant: R0, position: "senior", is_admin: false },
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-igor", name: "Игорь", surname: "Портов", restaurant: PORT, position: "waiter", is_admin: false },
];
const [ROMAN, LENA, MARIA, ANNA] = PEOPLE;
const TOK = { tr: "u-roman", tl: "u-lena", tm: "u-maria", ta: "e-anna", ti: "e-igor" };
const SCORES = [
  { id: 1, name: "Анна", surname: "Смирнова", restaurant: R0, role: "seasonal", position: "waiter", quiz_id: "s0-q", score: 11, total: 12 },
  { id: 2, name: "Анна", surname: "Смирнова", restaurant: PORT, role: "seasonal", position: "waiter", quiz_id: "s0-old", score: 7, total: 10 },   // до перевода
];   // и два теста «Порта» из сервера демо (net2): Игорь и Лена
const mk = (x = {}) => makeServer({ today: "2026-11-26", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, scores: SCORES, net2: true, ...x });
// список заведений после этапа 61: видно своё и «Порт»
const ORG2 = normOrg({ ok: true, can_edit: true, venues: [{ name: R0, hidden: false, sort: 0 }, { name: PORT, hidden: false, sort: 1 }, { name: "Марико", hidden: true, sort: 2 }],
  positions: [{ id: "waiter", label: "Официант", base: "waiter", builtin: true, hidden: false, sort: 0 }], titles: {}, me: null });

// телефон: localStorage и sessionStorage в памяти, запросы — в сервер демо
const realFetch = globalThis.fetch, realLS = globalThis.localStorage, realSS = globalThis.sessionStorage;
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; };
let calls = [];
const useServer = (srv) => { calls = []; globalThis.fetch = async (u, init = {}) => { const fn = String(u).split("/rpc/")[1]; const b = JSON.parse(init.body || "{}"); calls.push({ fn, b }); return { ok: true, status: 200, json: async () => srv.rpc(fn, b) }; }; };
const login = (tok) => globalThis.localStorage.setItem("sa_session_token", tok);
const phone = () => { globalThis.localStorage = mem(); globalThis.sessionStorage = mem(); _resetOrg(); };
const leave = () => { globalThis.fetch = realFetch; globalThis.localStorage = realLS; globalThis.sessionStorage = realSS; _resetOrg(); };
const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, para: {}, a11y: false };

describe("v199 · версия и журнал", () => {
  it("сборка v199, Дополнение 524 со словами владельца и решениями, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(199);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 524 — .*\(v199\)/);
    const part = c.slice(c.indexOf("# Дополнение 524"));
    expect(part).toContain("«я не хочу, что бы что-то перекликалось и у каждого заведения была своя статистика.");
    expect(part).toContain("к примеру управляющий, только то, за");
    expect(part).toContain("рейтинг и лига у сотрудника только своего заведения");
    expect(part).toContain("supabase/supabase-stage62-venue-walls.sql");
    expect(part).toContain("tools/claude/sql/test62.sh (39 проверок)");
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v199 · кто сеть и какое заведение показать (lib/org-model.js)", () => {
  it("сеть — владелец и «Руководящий состав»; менеджер, бармен, официант — нет", () => {
    expect([ROMAN, LENA, MARIA, ANNA].map(isNetwork)).toEqual([true, true, false, false]);
    expect(isNetwork(null)).toBe(false);
    expect(isNetwork({ position: "manager", is_admin: true })).toBe(true);   // владелец с должностью менеджера
  });
  it("не сеть — всегда своё заведение, что бы ни было выбрано", () => {
    expect(lensOf(PORT, { network: false, own: R0, venues: [R0, PORT] })).toBe(R0);
    expect(lensOf(LENS_ALL, { network: false, own: " Два  моря, Океан ", venues: [R0, PORT], all: true })).toBe(R0);
  });
  it("сеть: выбранное, если оно в списке; иначе «Вся сеть» (аналитика, отчёт) или своё (итог, новички, кандидаты, график)", () => {
    const o = { network: true, own: R0, venues: [R0, PORT] };
    expect(lensOf(PORT, o)).toBe(PORT);
    expect(lensOf(null, { ...o, all: true })).toBe(LENS_ALL);
    expect(lensOf(null, o)).toBe(R0);
    expect(lensOf(LENS_ALL, o)).toBe(R0);                       // где «Вся сеть» нет — своё
    expect(lensOf(LENS_ALL, { ...o, all: true })).toBe(LENS_ALL);
    expect(lensOf("Кафе", { ...o, all: true })).toBe(LENS_ALL); // заведение скрыли — снова вся сеть
    expect(lensOf("Кафе", o)).toBe(R0);
    expect(lensOf(null, { network: true, own: "", venues: [PORT, R0] })).toBe(PORT);   // своего нет — первое в списке
  });
  it("строки «по людям» — только выбранного заведения; «Вся сеть» — все", () => {
    expect(inLens(PORT, PORT)).toBe(true);
    expect(inLens(PORT, R0)).toBe(false);
    expect(inLens(PORT, " Порт ")).toBe(true);
    expect(inLens(LENS_ALL, R0)).toBe(true);
    expect(inLens("", R0)).toBe(true);
  });
  it("вкладки меню: у сотрудника и менеджера — только своё; у сети — все видимые и своё; без своего — все, как раньше", () => {
    expect(menuVenues(ORG2, ANNA)).toEqual([R0]);
    expect(menuVenues(ORG2, MARIA)).toEqual([R0]);
    expect(menuVenues(ORG2, ROMAN)).toEqual([R0, PORT]);
    expect(menuVenues(ORG2, LENA)).toEqual([R0, PORT]);
    expect(menuVenues(ORG2, { ...ANNA, restaurant: "" })).toEqual([R0, PORT]);
    expect(menuVenues(ORG2, { ...ANNA, restaurant: "Марико" })).toEqual(["Марико"]);   // скрытое своё — его меню нужно
  });
  it("почему чужое не открылось: сотруднику — по-человечески, владельцу — какой этап", () => {
    expect(lensErr("stage62")).toBe("Другое заведение откроется, когда владелец обновит сервер.");
    expect(lensErr("stage62", true)).toBe("Другое заведение откроется после обновления сервера: нужен этап базы 62, подскажет экран «Сервер».");
    expect(lensErr("no_venue")).toBe("Этого заведения нет в списке. Обнови экран.");
    expect(lensErr("forbidden")).toBe("Другие заведения видит только руководство сети.");
    expect(lensErr("что-то")).toBe("Нет связи. Попробуй ещё раз.");
  });
});

describe("v199 · общий выбор заведения (lib/org.js)", () => {
  beforeEach(phone);
  afterEach(leave);
  it("взгляд сети: своё первым, «Вся сеть» — где она есть, выбор для чужого заведения", () => {
    const l = lensFor(ROMAN, ORG2, null, { all: true });
    expect(l).toMatchObject({ venue: LENS_ALL, all: true, own: R0, mine: false, network: true, venues: [R0, PORT], withAll: true });
    expect(lensFor(ROMAN, ORG2, PORT)).toMatchObject({ venue: PORT, all: false, mine: false, withAll: false });
    expect(lensFor(LENA, ORG2, R0)).toMatchObject({ venue: R0, mine: true });
  });
  it("не сеть: своё заведение, ленты нет, выбрать нечего", () => {
    expect(lensFor(MARIA, ORG2, PORT, { all: true })).toMatchObject({ venue: R0, all: false, mine: true, network: false, venues: [], withAll: false });
  });
  it("выбор живёт до закрытия приложения (sessionStorage), а не навсегда", () => {
    setLens(PORT);
    expect(globalThis.sessionStorage.getItem(LENS_KEY)).toBe(PORT);
    expect(globalThis.localStorage.getItem(LENS_KEY)).toBe(null);
    setLens(null);
    expect(globalThis.sessionStorage.getItem(LENS_KEY)).toBe(null);
  });
  it("viewRpc: своё — напрямую, чужое у сети — через org_view с выбранным заведением", async () => {
    useServer(mk()); login("tr");
    const own = await viewRpc("gain_month", { p_month: null }, lensFor(ROMAN, ORG2, R0));
    expect(calls.map((c) => c.fn)).toEqual(["gain_month"]);
    expect(own.rest).toBe(R0);
    calls = [];
    const port = await viewRpc("gain_month", { p_month: null }, lensFor(ROMAN, ORG2, PORT));
    expect(calls).toEqual([{ fn: "org_view", b: { p_token: "tr", p_restaurant: PORT, p_fn: "gain_month", p_args: { p_month: null } } }]);
    expect(port.rest).toBe(PORT);
  });
  it("viewRpc: заведение задаёт взгляд — p_restaurant экрана в org_view не уходит; у менеджера — всегда напрямую", async () => {
    useServer(mk()); login("tr");
    await viewRpc("candidate_list", { p_restaurant: PORT }, lensFor(ROMAN, ORG2, PORT));
    expect(calls[0]).toEqual({ fn: "org_view", b: { p_token: "tr", p_restaurant: PORT, p_fn: "candidate_list", p_args: {} } });
    calls = []; login("tm");
    await viewRpc("newbie_list", {}, lensFor(MARIA, ORG2, PORT));
    expect(calls.map((c) => c.fn)).toEqual(["newbie_list"]);
  });
  it("viewRpc: без этапа 62 — stage62; функции нет на сервере — как rpcMissing (экран скажет, какой этап нужен)", async () => {
    useServer(mk({ noStage62: true })); login("tr");
    expect(await viewRpc("gain_month", {}, lensFor(ROMAN, ORG2, PORT))).toEqual({ ok: false, error: "stage62" });
    useServer(mk()); login("tr");
    expect(rpcMissing(await viewRpc("mastery_list", {}, lensFor(ROMAN, ORG2, PORT)))).toBe(true);
  });
});

describe("v199 · сервер демо: этап 62 по тем же правилам", () => {
  const names = (r) => r.rows.map((x) => x.name + " · " + x.restaurant).sort();
  it("результаты тестов: официант — своё заведение и свой прежний из «Порта», сеть — всё, без этапа 62 — всё", () => {
    const s = mk();
    expect(names(s.rpc("team_scores", { p_token: "ta" }))).toEqual(["Анна · Два моря, Океан", "Анна · Порт"]);
    expect(s.rpc("team_scores", { p_token: "ta" }).scope).toBe("restaurant");
    expect(names(s.rpc("team_scores", { p_token: "tm" }))).toEqual(["Анна · Два моря, Океан"]);
    expect(names(s.rpc("team_scores", { p_token: "ti" }))).toEqual(["Анна · Порт", "Игорь · Порт", "Лена · Порт"]);
    expect(names(s.rpc("team_scores", { p_token: "tl" })).length).toBe(4);
    expect(s.rpc("team_scores", { p_token: "tr" }).scope).toBe("all");
    expect(names(mk({ noStage62: true }).rpc("team_scores", { p_token: "ta" })).length).toBe(4);
  });
  it("org_view: только сеть; заведение из списка; разрешённые функции; ответ — как у руководителя того заведения", () => {
    const s = mk();
    const v = (tok, rest, fn) => s.rpc("org_view", { p_token: tok, p_restaurant: rest, p_fn: fn, p_args: {} });
    expect([v("tm", PORT, "gain_month").error, v("ta", PORT, "gain_month").error, v("x", PORT, "gain_month").error]).toEqual(["forbidden", "forbidden", "auth"]);
    expect([v("tr", "Кафе", "gain_month").error, v("tr", PORT, "drop_all").error, v("tr", " ", "gain_month").error]).toEqual(["no_venue", "bad_fn", "bad_request"]);
    expect(v("tr", PORT, "gain_month").rest).toBe(PORT);
    expect(v("tl", PORT, "newbie_list").team.map((x) => x.name)).toEqual(["Игорь Портов"]);
    expect(s.rpc("gain_month", { p_token: "tr" }).rest).toBe(R0);   // после запроса — снова своё
  });
  it("трудные вопросы одного заведения: есть с этапом 62, без него — как отсутствующая функция", () => {
    expect(mk().rpc("quiz_hard_questions_at", { p_token: "tr", p_restaurant: PORT })).toEqual([]);
    expect(rpcMissing(mk({ noStage62: true }).rpc("quiz_hard_questions_at", { p_token: "tr", p_restaurant: PORT }))).toBe(true);
  });
});

describe("v199 · лента заведений и экраны", () => {
  beforeEach(phone);
  afterEach(leave);
  it("лента: «Вся сеть», своё с пометкой и «Порт»; выбранное отмечено; у не-сети ленты нет", () => {
    const html = R(h(VenueLens, { a11y: false, lens: lensFor(ROMAN, ORG2, PORT, { all: true }) }));
    expect(html).toContain('data-venue-lens="Порт"');
    expect(html).toContain('<span data-venue-pick="*" data-on="0">Вся сеть</span>');
    expect(html).toContain('<span data-venue-pick="Два моря, Океан" data-on="0">Два моря, Океан · своё</span>');
    expect(html).toContain('<span data-venue-pick="Порт" data-on="1">Порт</span>');
    expect(R(h(VenueLens, { a11y: false, lens: lensFor(MARIA, ORG2, PORT, { all: true }) }))).toBe("");
    // одно заведение в сети и без «Вся сеть» — выбирать нечего
    expect(R(h(VenueLens, { a11y: false, lens: lensFor(ROMAN, normOrg({ ...ORG2, ok: true, can_edit: true, venues: [{ name: R0, hidden: false, sort: 0 }], positions: [], titles: {}, me: null }), null) }))).toBe("");
  });
  it("подсказка, когда чужое не открылось: владельцу — про этап, руководящему составу — без этапа", () => {
    expect(R(h(LensNote, { a11y: false, code: "stage62", admin: true }))).toContain("нужен этап базы 62");
    expect(R(h(LensNote, { a11y: false, code: "stage62" }))).toContain("когда владелец обновит сервер");
    expect(R(h(LensNote, { a11y: false, code: "" }))).toBe("");
  });
  it("«Что дало обучение» и «Новички»: у владельца — лента заведений, у менеджера — нет", () => {
    const g = (p) => R(h(GainScreen, { T, a11y: false, profile: p, onBack: () => {} }));
    expect(g(ROMAN)).toContain("data-venue-lens=");
    expect(g(LENA)).toContain('data-venue-lens="Два моря, Океан"');   // по умолчанию — своё
    expect(g(MARIA)).not.toContain("data-venue-lens");
    const n = (p) => R(h(NewbiesScreen, { T, a11y: false, profile: p, onBack: () => {} }));
    expect(n(ROMAN)).toContain("data-venue-lens=");
    expect(n(MARIA)).not.toContain("data-venue-lens");
  });
  it("рейтинг: у официанта и менеджера — только своё заведение; у владельца — вся сеть", () => {
    const lb = [
      { name: "Игорь", surname: "Портов", restaurant: PORT, role: "seasonal", position: "waiter", total: 1, sum: 50, avg: 50 },
      { name: "Анна", surname: "Смирнова", restaurant: R0, role: "seasonal", position: "waiter", total: 1, sum: 92, avg: 92 },
    ];
    globalThis.localStorage.setItem("sa_lb_scope", "net");
    const board = (p) => R(h(LeaderboardScreen, { T, leaderboard: lb, scores: [], profile: p, onBack: () => {} }));
    expect(board(ANNA)).toContain("Анна");
    expect(board(ANNA)).not.toContain("Игорь");
    expect(board(ANNA)).not.toContain("во всей сети");
    expect(board(ROMAN)).toContain("Игорь");
  });
});

describe("v199 · где и как это встроено", () => {
  it("аналитика: лента «Вся сеть» или заведение; данные, люди, лазейки и вопросы — по выбранному; заведения — нажатием", () => {
    const a = rd("ui/screens-admin.jsx");
    expect(a).toContain("const lens = useLens(profile, { all: true });");
    expect(a).toContain("const scoped = React.useMemo(() => (scores||[]).filter(s => allScope ? inLens(vName, s.restaurant) : s.restaurant === profile?.restaurant), [scores, allScope, profile, vName]);");
    expect(a).toContain('(want ? rpc("quiz_hard_questions_at", { p_token: saToken(), p_restaurant: want }) : rpc("quiz_hard_questions", { p_token: saToken() }))');
    expect(a.match(/if \(!inLens\(vName, r\.restaurant\)\) return;/g).length).toBe(2);   // люди и лазейки
    expect(a).toContain('<div style={{ padding:"0 14px" }}><VenueLens a11y={a11y} lens={lens} /></div>');
    expect(a).toContain("{allScope && !vName && rests.length > 1 ? (");
    expect(a).toContain("const go = lens.venues.includes(r.name) ? () => { vibrate(\"light\"); lens.pick(r.name); } : null;");
  });
  it("отчёты: заведения — общий выбор сети, в Excel и PDF — только выбранное заведение", () => {
    const r = rd("ui/report.jsx");
    expect(r).toContain("const lens = useLens(profile, { all: true });");
    expect(r).toContain('const r = vName ? { ...r0, scope: "restaurant", restaurant: vName, people: (r0.people || []).filter((p) => inLens(vName, p && p.person && p.person.restaurant)) } : r0;');
    expect(r).toContain('data-rp-venue="*" onClick={() => { vibrate("light"); setFilter("all"); lens.pick(LENS_ALL); }}>Вся сеть</button>');
  });
  it("итог месяца и новички: чужое заведение — только посмотреть", () => {
    const g = rd("ui/gain.jsx"), n = rd("ui/newbie.jsx");
    expect(g).toContain("const act = !lens.mine ? null : s === \"no_tg\" ?");
    expect(g).toContain('{lens.mine ? (<>{h("1-го числа в Telegram", null, "tg")}');
    expect(g).toContain("React.useEffect(() => { setNudged({}); setNote(\"\"); load(month); }, [load, month, lens.venue]);");
    expect(n).toContain("const act2 = lead && !ro;   // кнопки руководителя — только в своём заведении");
    expect(n).toContain('viewRpc("newbie_list", {}, ln)');
  });
  it("собеседование: история на телефоне у каждого заведения своя, ответ по прежнему заведению не смешивается", () => {
    const c = rd("ui/candidate.jsx");
    expect(c).toContain('const sKey = lens.mine ? STORE_KEY : STORE_KEY + "|" + lens.venue;');
    expect(c).toContain('const hKey = lens.mine ? HR_REF_KEY : HR_REF_KEY + "|" + lens.venue;');
    expect(c).toContain("if (!d || !d.ok || !Array.isArray(d.items) || keyRef.current !== k) return;");
    expect(c).toContain('viewRpc("candidate_save", { p_restaurant: restaurant, p_result: JSON.stringify(clean) }, lensRef.current)');
    expect(c).not.toMatch(/rpc\("candidate_|rpc\("hr_quality_/);
  });
  it("график: выбранное заведение; копия на телефоне, «моя смена», смены из чата и опоздания — только своего", () => {
    const s = rd("ui/schedule.jsx");
    expect(s).toContain("const profile = React.useMemo(() => (profile0 && !lens.mine && lens.venue ? { ...profile0, restaurant: lens.venue } : profile0), [profile0, lens.mine, lens.venue]);");
    expect(s).toContain("if (mineRef.current) try {   // v199: копия на телефоне и «моя смена» — только своего заведения");
    expect(s).toContain("if (!chatApi || !chatApi.shiftBoard || !profile?.restaurant || !lens.mine)");
    expect(s).toContain("if (!profile?.restaurant || !lens.mine) { setLates([]); return; }");
    expect(s).toContain("saveCfg(next, pendingRest.current);");   // настройки уходят в своё заведение, даже если выбрали другое
    expect(s).toContain('if (dirty) { setMsg("Сначала сохрани график или отмени правки");');
  });
  it("меню, рейтинг, лига и брифинг", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("const venues = menuVenues(org, profile);");
    const g = rd("ui/screens-gamification.jsx");
    expect(g).toContain("const ownOnly = !isNetwork(profile) && !!profile?.restaurant;");
    const l = rd("ui/league.jsx");
    expect(l).toContain("const restCount = st.status === \"ok\" && !ownOnly ? (st.cup || []).length : 0;");
    expect(l).toContain('const prevKey = ownOnly ? "prev_rest" : scope === "net" || !twoScopes ? "prev_net" : "prev_rest";');
    expect(rd("ui/briefing.jsx")).toContain('rpc("quiz_hard_questions_at", { p_token: tok, p_restaurant: restaurant }).then((r) => (rpcMissing(r) ? hardAll() : r))');
  });
});

describe("v199 · сервер: этап 62", () => {
  const sql = rd("supabase/supabase-stage62-venue-walls.sql");
  it("стены: тесты (и свои прежние), лига, бот, фото, меню, «меню выучено», график; нужен этап 21; повторный запуск", () => {
    expect(sql).toContain("raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';");
    expect(sql).toContain("or (s.name = $2 and coalesce(s.surname, '''') = $3)'");
    for (const f of ["create or replace function team_scores(p_token text)", "_sa_league_week_all", "_sa_staff_photos_all", "_sa_rest_ok(c jsonb, p_rest text)",
      "menu_set", "menu_progress_set", "schedule_load", "schedule_publications_list", "schedule_set_wish", "_sa_nudges_at"]) expect(sql).toContain(f);
    expect(sql).toContain("После повторного запуска этапов 4, 9, 21, 25, 28, 29 или");
  });
  it("взгляд сети: _sa_caller с sa.lens только у сети; org_view — список функций; трудные вопросы одного заведения", () => {
    expect(sql).toContain("v_lens := nullif(btrim(coalesce(current_setting('sa.lens', true), '')), '');");
    expect(sql).toContain("if v_net and v_lens is not null then v_rest := v_lens; end if;");
    expect(sql).toContain("create or replace function org_view(p_token text, p_restaurant text, p_fn text, p_args jsonb default '{}'::jsonb)");
    for (const f of ["gain_month", "newbie_list", "mastery_list", "team_achievements", "candidate_list", "candidate_save", "candidate_decide", "candidate_delete", "hr_quality_get", "hr_quality_save"])
      expect(sql).toContain("when '" + f + "' then r := to_jsonb(" + f + "(");
    expect(sql).toContain("else r := jsonb_build_object('ok', false, 'error', 'bad_fn');");
    expect(sql).toContain("create or replace function quiz_hard_questions_at(p_token text, p_restaurant text)");
    expect(sql).toContain("взгляд сети: ' || case when pg_get_functiondef('public._sa_caller(text)'::regprocedure) like '%sa.lens%'");
  });
  it("«Сервер» знает этап 62, README — строка 71, проверки — в памятке инструментов", () => {
    expect(STAGES.find((s) => s.n === "62")).toEqual({ n: "62", file: "supabase-stage62-venue-walls.sql", what: "У каждого заведения своя статистика, руководство сети смотрит по заведениям", fn: "org_view" });
    expect(rd("supabase/README.md")).toContain("| 71 | `supabase-stage62-venue-walls.sql` | **У каждого заведения своя статистика** (v199)");
    const t = rd("tools/claude/README.md");
    expect(t).toContain("bash sql/test62.sh");
    expect(t).toContain("`e2e-v199.mjs` — v199 (Доп. 524)");
    expect(rd("tools/claude/sql/test62.sh")).toContain("org_view: владелец сохраняет кандидата и итог AI HR в «Порт» — запись именно в «Порт»");
  });
});
