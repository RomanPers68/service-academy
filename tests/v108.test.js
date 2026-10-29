// v108 (Доп. 421): тепло в команде. Владелец (29.10): «Вот эти» — «Спасибо коллеге» (карточка в чате, «спасибо» копятся в
// профиле рядом с благодарностями гостей и считаются в «Сотруднике недели») и дни рождения и годовщины («У Ильи сегодня
// день рождения», «Вера год с нами», поздравить одной кнопкой). Сервер — supabase/supabase-stage42-thanks.sql (сводки,
// сообщения бота и разбор дат сверены с lib/team-warm.js на Postgres: tools/claude/sql/test42.sh), экраны — ui/chat.jsx,
// ui/chat-cards.jsx, ui/peer-thanks.jsx, ui/screens-gamification.jsx, ui/schedule.jsx; демо — tools/claude/demo-app.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import {
  THX_MAX, THX_PTS, THX_DAY_MAX, CHEER_FROM, CHEER_TO, BOT_NAME, cutText, yearsWord, dateWord, genName, thxChips, thxFromText, thxView, cheerView, warmCardSum,
  thxPing, cheerDm, bdayOf, joinedOf, cheersDue, peerSub, weekThanks, weekStars,
} from "../lib/team-warm.js";
import { cardSummary, actTiles, actLayout, intents, INTENT_LABEL } from "../lib/chat-smart.js";
import { STAGES, CRON_JOBS } from "../lib/server-check.js";
import { HINTS } from "../data/hints.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");

describe("v108: слова", () => {
  it("годы, даты, имя в родительном падеже — у кого день рождения", () => {
    expect([1, 2, 3, 4, 5, 11, 12, 21, 22, 25, 101, 111].map(yearsWord)).toEqual(["год", "2 года", "3 года", "4 года", "5 лет", "11 лет", "12 лет", "21 год", "22 года", "25 лет", "101 год", "111 лет"]);
    expect(dateWord("2025-10-29")).toBe("29 октября 2025");
    expect(dateWord("x")).toBe("");
    const gen = { "Илья": "Ильи", "Анна": "Анны", "Ольга": "Ольги", "Мария": "Марии", "Ксения": "Ксении", "Дарья": "Дарьи", "Вера": "Веры", "Пётр": "Петра", "Петр": "Петра",
      "Павел": "Павла", "Лев": "Льва", "Роман": "Романа", "Тимур": "Тимура", "Андрей": "Андрея", "Игорь": "Игоря", "Любовь": "Любови", "Никита": "Никиты", "Саша": "Саши",
      "Зоя": "Зои", "Нелли": "Нелли", "Лука": "Луки" };
    for (const [n, g] of Object.entries(gen)) expect(genName(n), n).toBe(g);
    expect(genName("Мишель", true)).toBe("Мишели");
    expect(genName("Ирэн", true)).toBe("Ирэн");
    expect(genName("")).toBe("");
  });
  it("подсказки «за что» — под того, кому спасибо", () => {
    expect(thxChips(false)).toEqual(["выручил на смене", "подменил", "помог с гостем", "научил новому", "поддержал"]);
    expect(thxChips(true)).toEqual(["выручила на смене", "подменила", "помогла с гостем", "научила новому", "поддержала"]);
  });
  it("из строки ввода: без «спасибо» и «большое», кому — по «@Имя», если такой один", () => {
    const M = [{ id: "e-p", name: "Пётр Орлов", pos: "waiter" }, { id: "e-a", name: "Анна Смирнова", pos: "waiter" }, { id: "e-a2", name: "Анна Ли", pos: "host" }];
    expect(thxFromText("Петя, спасибо, выручил на банкете", M)).toEqual({ text: "Петя, выручил на банкете", to: null });
    expect(thxFromText("Спасибо большое за помощь на банкете!", M)).toEqual({ text: "за помощь на банкете", to: null });
    expect(thxFromText("@Пётр спасибо, подменил", M)).toEqual({ text: "подменил", to: { id: "e-p", name: "Пётр Орлов", pos: "waiter" } });
    expect(thxFromText("@Анна спасибо", M)).toEqual({ text: "@Анна", to: null });   // две Анны — не угадываем, «@Анна» остаётся
    expect(thxFromText("спасибо", M)).toEqual({ text: "", to: null });
    expect(cutText("  а   б ", 140)).toBe("а б");
    expect(cutText("а".repeat(300), 140)).toBe("а".repeat(139) + "…");
  });
  it("карточка «Спасибо»: кому, за что, кто присоединился; «Тоже спасибо» — не автору, не тому, кому спасибо, и раз", () => {
    const card = { t: "thx", to: { id: "e-i", name: "Илья Белов", pos: "bartender" }, text: "помог с гостями у бара", plus: [{ id: "e-v", n: "Вера Соколова" }] };
    const other = thxView(card, { id: "e-p" }, "e-o");
    expect(other).toEqual({ title: "Илья Белов", sub: "Помог с гостями у бара", self: false, own: false, mine: false, n: 2, line: "Ещё спасибо: Вера С.", act: "plus", btn: "Тоже спасибо" });
    expect(thxView(card, { id: "e-i" }, "e-o")).toMatchObject({ self: true, line: "Ещё спасибо тебе: Вера С.", act: null });
    expect(thxView(card, { id: "e-o" }, "e-o")).toMatchObject({ own: true, act: null });
    expect(thxView(card, { id: "e-v" }, "e-o")).toMatchObject({ mine: true, line: "Ещё спасибо: ты", act: null });
    expect(thxView({ ...card, plus: [] }, { id: "e-i" }, "e-o").line).toBe("Сохранилось в «Я» → «Спасибо от коллег»");
    expect(thxView({ ...card, plus: [] }, { id: "e-o" }, "e-o").line).toBe("Карточку видит вся команда");
    expect(thxView({ ...card, plus: [] }, { id: "e-p" }, "e-o").line).toBe("");
    expect(thxView(null, null).title).toBe("");
  });
  it("день рождения и годовщина: «У Ильи сегодня день рождения», «Вера год с нами»; самому — «У тебя…», «Сегодня 3 года, как ты с нами»", () => {
    const bd = { t: "bday", emp: "e-i", name: "Илья Белов", pos: "bartender", day: "2026-10-29", greet: [{ id: "e-p", n: "Пётр Орлов" }] };
    expect(cheerView(bd, { id: "e-a" })).toEqual({ title: "У Ильи сегодня день рождения", sub: "Бармен", self: false, mine: false, n: 1, years: 0, line: "Поздравили: Пётр О.", act: "cheer", btn: "Поздравить" });
    expect(cheerView(bd, { id: "e-i" })).toMatchObject({ title: "У тебя сегодня день рождения", line: "Тебя поздравили: Пётр О.", act: null });
    expect(cheerView(bd, { id: "e-p" })).toMatchObject({ mine: true, act: null, line: "Поздравили: ты" });
    expect(cheerView({ ...bd, greet: [] }, { id: "e-i" }).line).toBe("Карточку видит вся команда");
    expect(cheerView({ ...bd, greet: [] }, { id: "e-a" }).line).toBe("Пока никто не поздравил");
    const an = { t: "anniv", emp: "e-v", name: "Вера Соколова", pos: "waiter", years: 1, since: "2025-10-29", greet: [] };
    expect(cheerView(an, { id: "e-a" })).toMatchObject({ title: "Вера год с нами", sub: "Официант · в команде с 29 октября 2025", years: 1 });
    expect(cheerView({ ...an, years: 3 }, { id: "e-v" }).title).toBe("Сегодня 3 года, как ты с нами");
    expect(cheerView({ ...an, name: "Ольга Ли", years: 5 }, { id: "e-a" }).title).toBe("Ольга 5 лет с нами");
    expect(cheerView({ t: "bday", name: "Мария Ким" }, { id: "x" }).title).toBe("У Марии сегодня день рождения");
  });
  it("сводки в списке чатов и сообщения бота — как у сервера (_sa_ty_sum, _sa_ty_ping, _sa_ty_dm)", () => {
    const thx = { t: "thx", to: { name: "Пётр Орлов" }, text: "выручил на банкете" };
    expect(warmCardSum(thx)).toBe("Спасибо: Пётр Орлов, выручил на банкете");
    expect(warmCardSum({ ...thx, text: "" })).toBe("Спасибо: Пётр Орлов");
    expect(warmCardSum({ t: "bday", name: "Илья Белов" })).toBe("День рождения: Илья Белов");
    expect(warmCardSum({ t: "anniv", name: "Вера Соколова", years: 1 })).toBe("Вера Соколова: год с нами");
    expect(warmCardSum({ t: "anniv", name: "Вера Соколова", years: 3 })).toBe("Вера Соколова: 3 года с нами");
    expect(cardSummary(thx)).toBe("Спасибо: Пётр Орлов, выручил на банкете");
    expect(cardSummary({ t: "bday", name: "Илья Белов" })).toBe("День рождения: Илья Белов");
    expect(thxPing("Анна Смирнова", "выручил на банкете")).toBe("Анна С. говорит тебе спасибо: «выручил на банкете»");
    expect(thxPing("Мария Ким", "")).toBe("Мария К. говорит тебе спасибо");
    expect(cheerDm({ t: "bday", name: "Илья Белов" })).toBe("Илья, с днём рождения\nВ «Вся команда» тебя поздравляют.");
    expect(cheerDm({ t: "anniv", name: "Вера Соколова", years: 1 })).toBe("Вера, сегодня год, как ты с нами\nВ «Вся команда» тебя поздравляют.");
    expect(BOT_NAME).toBe("Академия");
  });
});

describe("v108: даты из графика", () => {
  it("«Д.р.» и «В команде с» — как на сервере (_sa_ty_bday, _sa_ty_joined)", () => {
    expect(["15.03", " 1.2 ", "15.03.1990", "31.02", "abc", "", "29.02", "00.10", "10.13"].map((v) => { const b = bdayOf(v); return b ? [b.d, b.m] : null; }))
      .toEqual([[15, 3], [1, 2], [15, 3], null, null, null, [29, 2], null, null]);
    expect(["29.10.2023", "2023-10-29", "31.02.2023", "29.02.2023", "29.02.2024", "1.2.2020", "2023-13-01", "x"].map(joinedOf))
      .toEqual(["2023-10-29", "2023-10-29", null, null, "2024-02-29", "2020-02-01", null, null]);
  });
  it("что праздновать: день рождения, годовщина (целые годы), 29 февраля — 28-го в невисокосный год", () => {
    expect(cheersDue("2026-10-29", { bday: "29.10", joined: "29.10.2023" })).toEqual([{ kind: "bday" }, { kind: "anniv", years: 3, since: "2023-10-29" }]);
    expect(cheersDue("2026-10-29", { bday: "30.10", joined: "2026-10-29" })).toEqual([]);
    expect(cheersDue("2027-02-28", { bday: "29.02", joined: "2024-02-29" })).toEqual([{ kind: "bday" }, { kind: "anniv", years: 3, since: "2024-02-29" }]);
    expect(cheersDue("2028-02-28", { bday: "29.02", joined: "2024-02-29" })).toEqual([]);
    expect(cheersDue("2028-02-29", { bday: "29.02" })).toEqual([{ kind: "bday" }]);
    expect(cheersDue("x", { bday: "29.10" })).toEqual([]);
    expect([CHEER_FROM, CHEER_TO]).toEqual([9, 21]);
  });
});

describe("v108: «Сотрудник недели» и «Я»", () => {
  const WS = Date.parse("2026-10-26T00:00:00");
  const scores = [{ name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter", score: 8, updated_at: "2026-10-27T12:00:00" },
    { name: "Пётр", surname: "Орлов", restaurant: "R", position: "waiter", score: 9, updated_at: "2026-10-28T12:00:00" },
    { name: "Пётр", surname: "Орлов", restaurant: "R", position: "waiter", score: 9, updated_at: "2026-10-20T12:00:00" },   // прошлая неделя
    { name: "Илья", surname: "Белов", restaurant: "R", position: "bartender", score: 7, updated_at: "2026-10-28T12:00:00" },
    { name: "Роман", surname: "EMPTY", restaurant: "R", position: "waiter", score: 1, updated_at: "2026-10-28T12:00:00" }];
  const raw = { ok: true, list: [{ name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter", at: ["2026-10-27T10:00:00", "2026-10-28T10:00:00", "2026-10-20T10:00:00"] },
    { name: "Вера", surname: "Соколова", restaurant: "R2", position: "waiter", at: ["2026-10-28T10:00:00"] }, { name: "Роман", surname: "", restaurant: "R", position: "waiter", at: ["2026-10-28T10:00:00"] }] };
  it("«спасибо» за неделю: с понедельника, по людям", () => {
    const t = weekThanks(raw, WS);
    expect(t["Анна|Смирнова"]).toEqual({ name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter", n: 2 });
    expect(Object.keys(t).sort()).toEqual(["Анна|Смирнова", "Вера|Соколова", "Роман|"]);
    expect(weekThanks(null, WS)).toEqual({});
  });
  it("очки тестов и по 5 за каждое «спасибо»; своё заведение и сеть; «EMPTY» — без фамилии", () => {
    expect(THX_PTS).toBe(5);
    const t = weekThanks(raw, WS);
    expect(weekStars(scores, t, { weekStart: WS, tab: "waiter", rest: "R" })).toEqual([
      { name: "Анна", surname: "Смирнова", restaurant: "R", pts: 18, thx: 2 }, { name: "Пётр", surname: "Орлов", restaurant: "R", pts: 9, thx: 0 },
      { name: "Роман", surname: "", restaurant: "R", pts: 6, thx: 1 }]);
    expect(weekStars(scores, t, { weekStart: WS, tab: "waiter", rest: null }).map((x) => x.name)).toEqual(["Анна", "Пётр", "Роман"]);
    expect(weekStars(scores, t, { weekStart: WS, tab: "waiter", rest: "R2" })).toEqual([{ name: "Вера", surname: "Соколова", restaurant: "R2", pts: 5, thx: 1 }]);
    expect(weekStars(scores, {}, { weekStart: WS, tab: "bartender", rest: "R" })).toEqual([{ name: "Илья", surname: "Белов", restaurant: "R", pts: 7, thx: 0 }]);
  });
  it("подпись пункта «Спасибо от коллег»", () => {
    expect(peerSub({ week: 3, total: 5 })).toBe("3 раза за неделю коллеги сказали спасибо");
    expect(peerSub({ week: 1, total: 1 })).toBe("1 раз за неделю коллеги сказали спасибо");
    expect(peerSub({ week: 0, total: 4 })).toBe("Всего спасибо от коллег: 4");
    expect(peerSub(null)).toBe("Коллеги говорят спасибо карточкой в «Вся команда»");
  });
  it("подсказка рейтинга говорит про «спасибо»", () => {
    expect(HINTS.leaderboard[1]).toBe("Сотрудник недели набрал больше всех очков с понедельника: за тесты и за «спасибо» от коллег, каждое по 5 очков. Каждый понедельник счёт начинается с нуля.");
  });
});

describe("v108: сервер (этап 42)", () => {
  const SQL = rd("supabase/supabase-stage42-thanks.sql");
  it("функции приложения, права, расписание, проверка этапов", () => {
    for (const f of ["chat_thanks(p_token text, p_to text, p_text text default '')", "chat_cheer(p_token text, p_msg bigint)", "thanks_peer(p_token text)", "thanks_week(p_token text)",
      "thanks_of(p_token text, p_emp text)", "cheer_poke(p_token text)"]) expect(SQL).toContain("create or replace function " + f);
    expect(SQL).toContain("cheer_poke(text) to anon, authenticated;");
    expect(SQL).toContain("revoke all on function _sa_ty_due(boolean, timestamptz, text, boolean) from public, anon, authenticated;");
    expect(SQL).toContain("cron.schedule('sa-cheer', '*/10 * * * *', 'select public.sa_cheer_tick()')");
    expect(SQL).toContain("Сначала этап 38 (supabase-stage38-chat.sql)");
    expect(SQL).not.toMatch(/language plpgsql stable security definer/);   // вход по токену — volatile (tests/v91)
  });
  it("правила: тому же — раз в день, от себя — до 15, за что — до 140; «Тоже спасибо» — не себе и не автору; окно 9–21; автор праздников — «Академия»", () => {
    expect(SQL).toContain("where p.from_id = c->>'id' and p.to_id = e.id and p.own and p.created_at >= day0");
    expect(SQL).toContain("p.own and p.created_at >= day0) >= 15 then");
    expect(SQL).toContain("t := _sa_chat_cut(p_text, 140);");
    expect(SQL).toContain("if t = 'thx' and m.emp_id = c->>'id' then return jsonb_build_object('ok', false, 'error', 'own'");
    expect(SQL).toContain("(extract(hour from lnow) < 9 or extract(hour from lnow) >= 21)");
    expect(SQL).toContain("values (ch.id, '', 'Академия', coalesce(ch.restaurant, ''), _sa_ty_sum(p_card), 'card', p_card)");
    expect(SQL).toContain("execute 'select started_at from sa_newbies where emp_id = $1 and not off' into ns using e.id;");
    expect(SQL).toContain("raise warning 'Поздравления: заведение % — %', r.rest, sqlerrm;");
  });
  it("тексты сервера — те же слова, что lib/team-warm.js", () => {
    for (const w of ["'Спасибо: '", "'День рождения: '", "' с нами'", "' говорит тебе спасибо'", "', с днём рождения'", "', как ты с нами'", "'В «Вся команда» тебя поздравляют.'",
      "then 'год' when n % 10 between 2 and 4", "'года' else 'лет'"]) expect(SQL, w).toContain(w);
  });
  it("«Сервер» в приложении знает этап 42 и расписание sa-cheer", () => {
    expect(STAGES.find((s) => s.n === "42")).toEqual({ n: "42", file: "supabase-stage42-thanks.sql", what: "Спасибо коллеге, дни рождения и годовщины", fn: "chat_thanks" });
    expect(CRON_JOBS.find((j) => j.name === "sa-cheer")).toEqual({ name: "sa-cheer", what: "Дни рождения и годовщины в «Вся команда»", n: "42" });
  });
});

describe("v108: приложение", () => {
  it("«+» в «Вся команда»: «Спасибо коллеге» в конце; подсказка «Спасибо карточкой» на «спасибо»", () => {
    expect(actTiles({ lead: false }, { kind: "team" }).slice(-1)).toEqual([{ id: "thx", label: "Спасибо коллеге" }]);
    for (const k of ["group", "dm", "leads", "net"]) expect(actTiles({ lead: true }, { kind: k }).map((t) => t.id)).not.toContain("thx");
    expect(intents("Петя, спасибо, выручил", {}, "team")).toContain("thx");
    expect(intents("Петя, спасибо, выручил", {}, "dm")).not.toContain("thx");
    expect(intents("Благодарю за смену", {}, "team")).toContain("thx");
    expect(INTENT_LABEL.thx).toBe("Спасибо карточкой");
    const CC = rd("ui/chat-cards.jsx");
    expect(CC).toContain("const tiles = actLayout(actTiles(me, chat));");
    expect(CC).toContain(".ch-tiles{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}");
    expect(CC).toContain(".ch-tile{grid-column:span 2;display:flex;flex-direction:column;");
    expect(CC).not.toContain(".ch-tile.wide");
    expect(CC).toContain('data-chat-plus={m.id}');
    expect(CC).toContain('data-chat-cheer-go={m.id}');
  });
  it("плитки «+» одного вида: «Опаздываю» и «Спасибо коллеге» в конце, неполный ряд — шире, без дыр (владелец, 29.10)", () => {
    const lay = (me, chat) => actLayout(actTiles(me, chat)).map((t) => t.id + ":" + t.span).join(",");
    // руководитель в «Вся команда» — 11: три ряда по три и «Опаздываю» со «Спасибо коллеге» по половине ряда
    expect(lay({ lead: true }, { kind: "team" })).toBe("photo:2,give:2,swap:2,task:2,share:2,poll:2,stop:2,brief:2,ai:2,late:3,thx:3");
    // сотрудник в «Вся команда» — 8: два ряда по три и два по половине
    expect(lay({ lead: false }, { kind: "team" })).toBe("photo:2,give:2,swap:2,share:2,poll:2,ai:2,late:3,thx:3");
    // сотрудник в своём чате — 7: ряд по три, потом четыре парами
    expect(lay({ lead: false }, { kind: "group" })).toBe("photo:2,give:2,swap:2,share:3,poll:3,ai:3,late:3");
    // руководитель в своём чате — 9: ровно три ряда
    expect(lay({ lead: true }, { kind: "group" })).toBe("photo:2,give:2,swap:2,task:2,share:2,poll:2,stop:2,ai:2,late:2");
    // личная у сотрудника — 5: три и две
    expect(lay({ lead: false }, { kind: "dm" })).toBe("photo:2,give:2,swap:2,share:3,ai:3");
    // ряды всегда полные: сумма в каждом ряду — 6
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const sp = actLayout(Array.from({ length: n }, (_, i) => ({ id: "t" + i, label: "" }))).map((t) => t.span);
      let row = 0;
      for (const x of sp) { row += x; expect(row).toBeLessThanOrEqual(6); if (row === 6) row = 0; }
      expect(row).toBe(0);
    }
    expect(actLayout(null)).toEqual([]);
  });
  it("чат: лист «Спасибо коллеге», «Сказать спасибо» в карточке коллеги, «Тоже спасибо» и «Поздравить» сразу, праздники при открытии", () => {
    const CH = rd("ui/chat.jsx");
    expect(CH).toContain("function ThanksSheet({ me, api, to0 = null, locked = false, text0 = \"\", onClose, onDone }) {");
    expect(CH).toContain('data-chat-person-thanks={p.id}');
    expect(CH).toContain('data-chat-person-thx={thx}');
    expect(CH).toContain('if ((a === "plus" || a === "cheer") && api.cheer) {');
    expect(CH).toContain("if (!api.cheerPoke || Date.now() - pokeAt < 3600e3) return;");
    expect(CH).toContain('w.kind === "thx" ? { thx: w.to || true }');
    const API = rd("lib/chat-api.js");
    for (const s of ['thanks: (to, text = "") => call("chat_thanks", { p_to: String(to), p_text: text || "" }),', 'cheer: (msg) => call("chat_cheer", { p_msg: msg }),',
      'thanksOf: (emp) => call("thanks_of", { p_emp: String(emp) }),', 'cheerPoke: () => call("cheer_poke", {}),']) expect(API).toContain(s);
  });
  it("«Я» → «Спасибо от коллег» рядом со «Спасибо от гостей»; рейтинг; график — «В команде с» и годовщины в «Сегодня»", () => {
    const APP = rd("App.jsx");
    const g = APP.indexOf('thanksOn && { key:"thanks", group:"Мой путь"'), p = APP.indexOf('peerInfo && { key:"peer", group:"Мой путь", icon:"thanks", label:"Спасибо от коллег"');
    expect(g).toBeGreaterThan(0);
    expect(p).toBeGreaterThan(g);
    expect(APP).toContain('const PeerThanksScreen = lazyOf(() => import("./ui/peer-thanks"), "PeerThanksScreen");');
    expect(APP).toContain('onSay={() => setChatOpen({ intent: { kind: "thx", at: Date.now() } })}');
    const GM = rd("ui/screens-gamification.jsx");
    expect(GM).toContain('rpc("thanks_week", { p_token: saToken() })');
    expect(GM).toContain("return weekStars(scores, weekThanks(thxRaw, weekStart), { weekStart, tab, rest: scope === \"rest\" ? myRest : null });");
    const SC = rd("ui/schedule.jsx");
    expect(SC).toContain('<Field label="В команде с" P={P}>');
    expect(SC).toContain('data-sched-anniv=""');
  });
  it("экран «Спасибо от коллег» рисуется (до ответа сервера), назад — линза; карточки в чате", async () => {
    const { PeerThanksScreen, whenOf } = await import("../ui/peer-thanks.jsx");
    const T = { screen: {}, lessHead: {}, backBtn2: {}, lessHeadTitle: {}, modCard: {}, para: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" } };
    const h = renderToString(React.createElement(PeerThanksScreen, { T, a11y: false, profile: { name: "Анна" }, onBack: () => {} }));
    expect(h).toContain('data-peer="loading"'); expect(h).toContain("Спасибо от коллег"); expect(h).toContain('data-lens="back"');
    const now = new Date("2026-10-29T12:00:00");
    expect([whenOf("2026-10-29T08:00:00", now), whenOf("2026-10-28T22:00:00", now), whenOf("2026-10-20T10:00:00", now)]).toEqual(["сегодня", "вчера", "20 октября"]);
    const { CardMsg } = await import("../ui/chat-cards.jsx");
    const row = (card, emp = "") => ({ m: { id: 7, emp, name: emp ? "Мария Ким" : "Академия", at: "2026-10-29T09:00:00", kind: "card", card } });
    const t = renderToString(React.createElement(CardMsg, { row: row({ t: "thx", to: { id: "e-i", name: "Илья Белов" }, text: "помог", plus: [] }, "u-m"), me: { id: "e-v" }, onAct: () => {}, onMenu: () => {} }));
    expect(t).toContain('data-chat-card="thx"'); expect(t).toContain("Илья Белов"); expect(t).toContain("Помог"); expect(t).toContain('data-chat-plus="7"'); expect(t).toContain("Тоже спасибо");
    const b = renderToString(React.createElement(CardMsg, { row: row({ t: "bday", emp: "e-i", name: "Илья Белов", pos: "bartender", greet: [] }), me: { id: "e-v" }, onAct: () => {}, onMenu: () => {} }));
    expect(b).toContain("У Ильи сегодня день рождения"); expect(b).toContain("Академия"); expect(b).toContain('data-chat-cheer-go="7"');
    const a = renderToString(React.createElement(CardMsg, { row: row({ t: "anniv", emp: "e-v", name: "Вера Соколова", pos: "waiter", years: 2, since: "2024-10-29", greet: [] }), me: { id: "e-v" }, onAct: () => {}, onMenu: () => {} }));
    expect(a).toContain("Сегодня 2 года, как ты с нами"); expect(a).not.toContain("data-chat-cheer-go=");
  });
});

describe("v108: демо-сервер — то же, что этап 42", () => {
  const P = [{ id: "u-m", name: "Мария", surname: "Ким", restaurant: "R", position: "manager" }, { id: "e-a", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter" },
    { id: "e-i", name: "Илья", surname: "Белов", restaurant: "R", position: "bartender" }, { id: "e-v", name: "Вера", surname: "Соколова", restaurant: "R", position: "waiter" },
    { id: "e-x", name: "Иван", surname: "Петров", restaurant: "R2", position: "waiter" }];
  const TOK = { tm: "u-m", ta: "e-a", ti: "e-i", tv: "e-v", tx: "e-x" };
  const SST = [{ id: 1, name: "Белов Илья", pos: "bar", bday: "29.10" }, { id: 2, name: "Соколова Вера", pos: "waiter", joined: "29.10.2024" }, { id: 3, name: "Смирнова Анна", pos: "waiter", bday: "01.01" }];
  const mk = (o = {}) => makeServer({ today: "2026-10-29", rest: "R", people: P, tok: TOK, sstaff: SST, cfg: { shifts: [], staff: SST }, plan: {}, menu: [], tgLinked: ["e-i", "e-v"],
    peerThanks: [{ from: "u-m", to: "e-a", text: "выручила с банкетом", at: -1, time: "21:50", plus: ["e-v"] }], ...o });
  it("при запуске — «спасибо» прошлых дней и праздники дня по времени: карточки от «Академии»", () => {
    const s = mk(), team = s.teamOf("R"), msgs = s.S.msgs.filter((m) => m.chat === team.id);
    expect(msgs.map((m) => m.body)).toEqual(["Спасибо: Анна Смирнова, выручила с банкетом", "День рождения: Илья Белов", "Вера Соколова: 2 года с нами"]);
    expect(msgs.map((m) => m.name)).toEqual(["Мария Ким", "Академия", "Академия"]);
    expect(msgs[2].card).toMatchObject({ t: "anniv", emp: "e-v", years: 2, since: "2024-10-29", day: "2026-10-29" });
    expect(s.rpc("cheer_poke", { p_token: "ta" })).toEqual({ ok: true, n: 0 });   // уже поставлены
    expect(mk({ cheers: false }).S.msgs.filter((m) => m.card && m.card.t !== "thx")).toEqual([]);
  });
  it("«Спасибо коллеге»: карточка, again, self, из другого заведения — нет; «Тоже спасибо»; в профиле и за неделю", () => {
    const s = mk();
    const r = s.rpc("chat_thanks", { p_token: "tv", p_to: "e-i", p_text: "  помог   с гостями " });
    expect([r.ok, r.msg.card.t, r.msg.card.to.name, r.msg.card.text, r.msg.body, r.tg]).toEqual([true, "thx", "Илья Белов", "помог с гостями", "Спасибо: Илья Белов, помог с гостями", true]);
    expect(s.rpc("chat_thanks", { p_token: "tv", p_to: "e-i", p_text: "ещё" })).toMatchObject({ ok: false, error: "again" });
    expect(s.rpc("chat_thanks", { p_token: "tv", p_to: "e-v" }).error).toBe("self");
    expect(s.rpc("chat_thanks", { p_token: "tv", p_to: "e-x" }).error).toBe("not_found");
    expect(s.rpc("chat_cheer", { p_token: "ta", p_msg: r.msg.id }).msg.card.plus.map((g) => g.id)).toEqual(["e-a"]);
    expect(s.rpc("chat_cheer", { p_token: "ta", p_msg: r.msg.id }).msg.card.plus.length).toBe(1);
    expect(s.rpc("chat_cheer", { p_token: "ti", p_msg: r.msg.id }).error).toBe("self");
    expect(s.rpc("chat_cheer", { p_token: "tv", p_msg: r.msg.id }).error).toBe("own");
    const me = s.rpc("thanks_peer", { p_token: "ti" });
    expect([me.week, me.total, me.items.length, me.items[0].name, me.items[0].plus]).toEqual([2, 2, 1, "Вера Соколова", ["Анна Смирнова"]]);
    const a = s.rpc("thanks_peer", { p_token: "ta" });
    expect([a.total, a.items[0].text, a.items[0].plus]).toEqual([2, "выручила с банкетом", ["Вера Соколова"]]);
    expect(s.rpc("thanks_of", { p_token: "tv", p_emp: "e-a" })).toEqual({ ok: true, n: 2, month: 2 });
    expect(s.rpc("thanks_of", { p_token: "tx", p_emp: "e-a" }).error).toBe("not_found");
    const w = s.rpc("thanks_week", { p_token: "tm" });
    expect(w.list.map((x) => x.name + ":" + x.at.length)).toEqual(["Анна:2", "Илья:2"]);
    for (let i = 0; i < 20; i++) s.S.thx.push({ id: 1000 + i, msg: 0, rest: "R", from: "u-m", fromName: "", to: "e-x", toName: "", text: "", own: true, at: "2026-10-29T10:00:00", day: "2026-10-29" });
    expect(s.rpc("chat_thanks", { p_token: "tm", p_to: "e-v" }).error).toBe("limit");
  });
  it("«Поздравить» — раз, себе — нет; не карточка — not_found", () => {
    const s = mk(), bd = s.S.msgs.find((m) => m.card && m.card.t === "bday");
    expect(s.rpc("chat_cheer", { p_token: "ta", p_msg: bd.id }).msg.card.greet.map((g) => g.n)).toEqual(["Анна Смирнова"]);
    expect(s.rpc("chat_cheer", { p_token: "ta", p_msg: bd.id }).msg.card.greet.length).toBe(1);
    expect(s.rpc("chat_cheer", { p_token: "ti", p_msg: bd.id }).error).toBe("self");
    expect(s.rpc("chat_cheer", { p_token: "ta", p_msg: 99999 }).error).toBe("not_found");
    expect(s.S.thx.some((x) => x.msg === bd.id)).toBe(false);   // «Поздравить» — не «спасибо»
    expect(s.cheerDue(false, null, true).map((x) => [x.kind, x.name, x.posted])).toEqual([["bday", "Илья Белов", true], ["anniv", "Вера Соколова", true]]);
  });
});
