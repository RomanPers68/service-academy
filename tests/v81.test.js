// v81 (Доп. 394): «Вопрос дня» в Telegram с кнопками ответа прямо в чате.
// Приложение раз в день кладёт на сервер очередь своих вопросов (этап 31: qday_push) — ошибки к повтору, потом
// пройденные темы; бот присылает вопрос в 12:00 по часам заведения с кнопками-буквами; нажатие приходит в функцию
// tg-bot (вебхук) → sa_tg_update; ответы приложение забирает (qday_inbox) в банк ошибок. Сервер проверяется на
// локальном PostgreSQL (tools/claude/sql/test31.sh), функция — под Bun (tools/claude/tgbot-harness.ts), вид — e2e-v81.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

if (!globalThis.localStorage) {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}
const Q = await import("../lib/qday.js");
const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const SR = [1, 3, 7, 30];

const quiz = (id, title, qs) => ({ id, type: "quiz", title, questions: qs });
const qq = (q, n = 3, c = 0, extra = {}) => ({ q, options: Array.from({ length: n }, (_, i) => "Вариант " + (i + 1)), correct: c, explanation: "Потому что так", ...extra });
const PROG = [
  { id: "m1", lessons: [{ id: "l1", type: "text" }, quiz("q1", "Встреча гостя", [qq("Вопрос 1"), qq("Вопрос 2", 4, 3), qq("С картинкой", 3, 0, { img: "x.webp" }), qq("Пять вариантов", 5)])] },
  { id: "m2", lessons: [quiz("q2", "Подача", [qq("Вопрос 3"), qq("Вопрос 4", 2, 1)])] },
  { id: "m3", lessons: [quiz("q3", "Вино", [qq("Вопрос 5"), qq("Вопрос 6"), qq("Вопрос 7"), qq("Вопрос 8")])] },
];

describe("v81: очередь «Вопроса дня»", () => {
  beforeEach(() => localStorage.clear());
  it("ключ вопроса — хэш текста: один и тот же, разный у разных вопросов", () => {
    expect(Q.qdayKey("Вопрос 1")).toBe(Q.qdayKey("  Вопрос 1 "));
    expect(Q.qdayKey("Вопрос 1")).not.toBe(Q.qdayKey("Вопрос 2"));
    expect(Q.qdayKey("Вопрос 1")).toMatch(/^q[0-9a-f]{8}$/);
  });
  it("для чата годится текст без картинки, 2–4 варианта, верный — один из них", () => {
    expect(Q.qdayFits(qq("Да"))).toBe(true);
    expect(Q.qdayFits(qq("Картинка", 3, 0, { img: "a.webp" }))).toBe(false);
    expect(Q.qdayFits(qq("Пять", 5))).toBe(false);
    expect(Q.qdayFits(qq("Один", 1))).toBe(false);
    expect(Q.qdayFits(qq("Не тот верный", 2, 2))).toBe(false);
    expect(Q.qdayFits({ ...qq("Длинный вариант"), options: ["a".repeat(201), "b"] })).toBe(false);
    expect(Q.qdayFits({ ...qq("x".repeat(401)) })).toBe(false);
  });
  it("сначала ошибки из тестов к повтору (по сроку), практика — нет; потом пройденные темы; до семи, без повторов", () => {
    const now = Date.now();
    const bank = [
      { ...qq("Ошибка поздняя"), due: now + 30 * 3600e3 },
      { ...qq("Ошибка ранняя"), due: now - 3600e3, lessonTitle: "Счёт" },
      { ...qq("Ошибка практики"), due: now - 3600e3, from: "practice" },
      { ...qq("Ошибка через неделю"), due: now + 7 * 864e5 },
      { ...qq("Вопрос 1"), due: now - 10 },   // тот же вопрос, что в тесте, — один раз
    ];
    const items = Q.buildQdayQueue({ mistakeBank: bank, programModules: PROG, quizDone: { q1: true, q3: true }, roleLabel: "Новичок", day: "2026-10-23", uk: "_А_Б", now });
    expect(items.length).toBe(7);
    expect(items.slice(0, 3).map((x) => x.q)).toEqual(["Ошибка ранняя", "Вопрос 1", "Ошибка поздняя"]);
    expect(items.map((x) => x.q)).not.toContain("Ошибка практики");
    expect(items.map((x) => x.q)).not.toContain("Ошибка через неделю");
    expect(items.map((x) => x.q)).not.toContain("С картинкой");
    expect(items.map((x) => x.q)).not.toContain("Вопрос 3");   // тест q2 не пройден
    expect(new Set(items.map((x) => x.k)).size).toBe(7);
    expect(items[0]).toEqual({ k: Q.qdayKey("Ошибка ранняя"), q: "Ошибка ранняя", o: ["Вариант 1", "Вариант 2", "Вариант 3"], c: 0, e: "Потому что так", t: "Счёт", r: "Новичок" });
    // тот же день и человек — тот же порядок
    expect(Q.buildQdayQueue({ mistakeBank: bank, programModules: PROG, quizDone: { q1: true, q3: true }, day: "2026-10-23", uk: "_А_Б", now }).map((x) => x.k))
      .toEqual(Q.buildQdayQueue({ mistakeBank: bank, programModules: PROG, quizDone: { q1: true, q3: true }, day: "2026-10-23", uk: "_А_Б", now }).map((x) => x.k));
  });
  it("новичку без пройденного — первые вопросы программы роли", () => {
    const items = Q.buildQdayQueue({ mistakeBank: [], programModules: PROG, quizDone: {}, day: "d", uk: "u" });
    expect(items.map((x) => x.q)).toEqual(["Вопрос 1", "Вопрос 2", "Вопрос 3", "Вопрос 4"]);
  });
  it("отправлять очередь — раз в день или когда вопросы другие", () => {
    const a = [{ k: "q1" }, { k: "q2" }];
    expect(Q.qdayNeedsPush("_u", "2026-10-23", a)).toBe(true);
    Q.qdayMarkPushed("_u", "2026-10-23", a);
    expect(Q.qdayNeedsPush("_u", "2026-10-23", a)).toBe(false);
    expect(Q.qdayNeedsPush("_u", "2026-10-23", [{ k: "q2" }])).toBe(true);
    expect(Q.qdayNeedsPush("_u", "2026-10-24", a)).toBe(true);
    expect(Q.qdayNeedsPush("_другой", "2026-10-23", a)).toBe(true);
  });
});

describe("v81: ответы из Telegram", () => {
  beforeEach(() => localStorage.clear());
  const A = (id, q, answer, correct, extra = {}) => ({ id, k: Q.qdayKey(q), q, o: ["а", "б", "в"], c: 0, e: "Разбор", t: "Тема", day: "2026-10-23", answer, correct, at: "2026-10-23T00:20:00Z", ...extra });
  it("новые ответы — только неучтённые и целые", () => {
    const items = [A(1, "В1", 1, false), A(2, "В2", 0, true), { id: 3, q: "без ответа", o: ["а", "б"] }, A(4, "", 0, true)];
    expect(Q.newQdayAnswers("_u", items).map((x) => x.id)).toEqual([1, 2]);
    Q.markQdaySeen("_u", [1]);
    expect(Q.newQdayAnswers("_u", items).map((x) => x.id)).toEqual([2]);
    expect(Q.newQdayAnswers("_другой", items).map((x) => x.id)).toEqual([1, 2]);
  });
  it("банк ошибок: неверно — добавить (или повтор сначала), верно — следующий интервал, после последнего — закреплён", () => {
    const now = 1_000_000;
    const bank = [
      { q: "Из банка", options: ["а", "б"], correct: 0, stage: 1, due: 5 },
      { q: "Почти выучен", options: ["а", "б"], correct: 0, stage: 4, due: 5 },
      { q: "Снова ошибся", options: ["а", "б"], correct: 0, stage: 2, due: 99 },
    ];
    const out = Q.applyQdayToBank(bank, [A(1, "Новая ошибка", 2, false), A(2, "Из банка", 0, true), A(3, "Почти выучен", 0, true), A(4, "Снова ошибся", 1, false), A(5, "Не из банка", 0, true)], SR, now);
    expect(out.map((m) => m.q)).toEqual(["Из банка", "Снова ошибся", "Новая ошибка"]);
    expect(out[0]).toMatchObject({ stage: 2, due: now + 3 * 864e5 });
    expect(out[1]).toMatchObject({ stage: 0, due: now });
    expect(out[2]).toMatchObject({ q: "Новая ошибка", options: ["а", "б", "в"], correct: 0, explanation: "Разбор", lessonTitle: "Тема", stage: 0, due: now, tg: true });
    expect(out[2].from).toBeUndefined();   // в следующую очередь Telegram такая ошибка тоже может попасть
  });
});

describe("v81: приложение", () => {
  const app = code(rd("App.jsx"));
  it("через 8 с после старта: сначала ответы (qday_inbox), потом очередь (qday_push); нет этапа 31 — не спрашиваем", () => {
    expect(app).toContain('import { buildQdayQueue, qdayNeedsPush, qdayMarkPushed, newQdayAnswers, markQdaySeen, applyQdayToBank } from "./lib/qday";');
    const a = app.indexOf('rpc("qday_inbox", { p_token: saToken() })'), b = app.indexOf('rpc("qday_push", { p_token: saToken(), p_items: items })');
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a);
    expect(app).toContain("if (rpcMissing(r)) { qdayOffRef.current = true; return; }");
    expect(app).toContain("setMistakeBank((prev) => applyQdayToBank(prev, fresh, SR_DAYS));");
    expect(app).toContain('if (n) logActivity("fix", n);');
    expect(app).toMatch(/\}, 8000\);\s*return \(\) => \{ alive = false; clearTimeout\(t\); \};\s*\}, \[profile, storageLoaded, role, ukP, todayKey, progCount\]\);/);
  });
  it("настройки сообщений: «Вопрос дня» — только если сервер знает этап 31, час — от сервера", async () => {
    const { prefRows } = await import("../ui/day-cards");
    const st26 = { ok: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true };
    expect(prefRows(st26).map((r) => r[0])).toEqual(["pair", "quest", "league", "fresh", "month", "master"]);
    const rows = prefRows({ ...st26, qday: false, qday_hour: 11 });
    expect(rows.map((r) => r[0])).toEqual(["pair", "quest", "league", "fresh", "month", "master", "qday"]);
    expect(rows[6]).toEqual(["qday", "Вопрос дня", "в 11:00 вопрос с кнопками ответа: из твоих ошибок и пройденных тем"]);
  });
});

describe("v81: сервер", () => {
  const sql = rd("supabase/supabase-stage31-qday.sql");
  const bot = rd("supabase/functions/tg-bot/index.ts");
  it("этап 31: требования, таблица, вид qday и его час, расписание раз в 10 минут", () => {
    for (const s of ["_sa_caller(text)", "sa_tg_send(bigint,text,text,text)", "_sa_tz(text)", "_sa_tg_chat(text,text)"]) expect(sql).toContain(s);
    expect(sql).toContain("create table if not exists sa_qday (");
    expect(sql).toContain("alter table sa_notify_prefs add column if not exists qday boolean not null default true;");
    expect(sql).toContain("insert into sa_settings (key, value) values ('qday_hour', '12') on conflict (key) do nothing;");
    expect(sql).toContain("p_kind not in ('pair', 'quest', 'league', 'fresh', 'month', 'master', 'qday')");
    expect(sql).toContain("select cron.schedule('sa-qday', '*/10 * * * *', 'select public.sa_qday_tick()')");
  });
  it("кнопки-буквы с «qd:<номер>:<вариант>»; ответ — один раз и только из того чата, куда ушёл вопрос", () => {
    expect(sql).toContain("'callback_data', 'qd:' || p_id || ':' || i");
    expect(sql).toContain("m := regexp_match(coalesce(cq->>'data', ''), '^qd:(\\d{1,18}):(\\d)$');");
    expect(sql).toContain("if nx.id is null or nx.chat_id is null or nx.chat_id is distinct from v_from then");
    expect(sql).toContain("where id = v_id and answered_at is null;");
    expect(sql).toContain("if coalesce(want, '') = '' or coalesce(p_secret, '') <> want then return jsonb_build_object('ok', false, 'error', 'secret'); end if;");
  });
  it("права: приложению — очередь, ответы и настройки; вебхук и код — только сервисному ключу", () => {
    expect(sql).toContain("grant execute on function sa_tg_update(text, jsonb) to service_role;");
    expect(sql).toContain("grant execute on function sa_tg_setup_take(text, boolean) to service_role;");
    expect(sql).toContain("revoke all on function sa_tg_update(text, jsonb) from public, anon, authenticated;");
    expect(sql).toContain("grant execute on function qday_push(text, jsonb) to anon, authenticated;");
    expect(sql).toContain("revoke all on table sa_qday from public, anon, authenticated;");
  });
  it("tg-bot: без секрета Telegram — мимо базы, всегда 200; вебхук — по коду, чужой не трогает; ответ — простым текстом", () => {
    expect(bot).toContain('const secret = req.headers.get("x-telegram-bot-api-secret-token") || "";');
    expect(bot).toContain('if (!secret) return new Response("ok");');
    expect(bot).toContain('const r = await rpc("sa_tg_update", { p_secret: secret, p_update: update });');
    expect(bot).toContain('if (cur && cur !== me && !force) {');
    expect(bot).toContain('allowed_updates: ["callback_query", "message"]');
    expect(bot).toContain("await take(true);   // код использован");
    expect(bot).toContain('"Content-Type": "text/plain; charset=utf-8"');
    expect(bot).toContain("--no-verify-jwt");
  });
});

describe("v81: ссылка «Разобрать ошибку»", () => {
  it("?go=mistakes из кнопки бота ведёт в «Работу над ошибками»; бот на /start — без тире", () => {
    const app = rd("App.jsx");
    expect(app).toMatch(/\["pair", "league", [^\]]*"mistakes"[^\]]*\]\.includes\(v\)/);   // v82: дальше в списке — "brief"
    expect(app).toContain('else if (g === "mistakes") navigate("mistakes");');
    const q = rd("supabase/supabase-stage31-qday.sql");
    expect(q).toContain("else 'mistakes' end");
    expect(q).toContain("лига недели. Уроки и тесты ждут в приложении.");
  });
});

describe("v81: метка и журнал", () => {
  it("«сборка v81», «Дополнение 394»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(8[1-9]|9\d|\d{3,})<\/span>/);   // v81 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 394 — вопрос дня в Telegram: кнопки ответа прямо в чате (v81)");
  });
});
