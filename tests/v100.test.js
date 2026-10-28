// v100 (Доп. 413): «смена» словами. Владелец написал боту «Smena» без слеша и получил подсказку про чат, а ответом на
// сообщение бота — «Этот ответ в чат не уходит». Теперь смены приходят и на слова («смена», «мои смены», «график»…), в том
// числе ответом на сообщение бота не о переписке; бот узнаёт и тех, кто входит через Telegram без напоминаний. Сервер —
// этап 39 (перезапуск), проверка в живом Postgres — tools/claude/sql/test39.sh (61). Здесь — швы в SQL и тексты.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const SQL = rd("supabase/supabase-stage39-everyday.sql");
const body = (fn) => { const m = new RegExp("create or replace function " + fn + "\\([\\s\\S]*?\\n(?:end; )?\\$\\$;").exec(SQL); return m ? m[0] : ""; };

// то же, что _sa_tg_is_shifts на сервере (для проверки списка слов здесь)
const isShifts = (t) => String(t || "").trim().replace(/[А-ЯЁ]/g, (c) => c.toLowerCase()).toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ")
  .replace(/^\//, "").replace(/(@[a-z0-9_]+)?[ .!?,…]*$/, "")
  .match(/^(smena|smeny|shifts|смена|смены|моя смена|мои смены|когда смена|когда смены|когда на смену|график|мой график|расписание)$/) !== null;

describe("v100: какие слова — просьба о сменах", () => {
  it("слова сервера — те же, что здесь", () => {
    expect(body("_sa_tg_is_shifts")).toContain("~ '^(smena|smeny|shifts|смена|смены|моя смена|мои смены|когда смена|когда смены|когда на смену|график|мой график|расписание)$'");
    expect(body("_sa_tg_is_shifts")).toContain("regexp_replace(regexp_replace(regexp_replace(_sa_low_e(btrim(coalesce(p_text, ''))), '\\s+', ' ', 'g'), '^/', ''), '(@[a-z0-9_]+)?[ .!?,…]*$', '')");
  });
  it("со слешем и без, регистр, «ё», пробелы, точка и «?» в конце, @имя_бота — смены; длиннее или другое слово — нет", () => {
    for (const t of ["smena", "Smena", "/smena", "/smena@SA_RestaurantBot", "Смена", "СМЕНЫ", "мои  смены!", "График?", "Когда на смену", "расписание.", "моя смёна"])
      expect(isShifts(t), t).toBe(true);
    for (const t of ["сменаа", "смена завтра у кого", "кто на смене", "привет", "", "/start"]) expect(isShifts(t), t).toBe(false);
  });
});

describe("v100: вебхук бота (sa_tg_update этапа 39)", () => {
  const upd = body("sa_tg_update");
  it("ответ на сообщение бота уходит в чат, кроме «смена» на сообщение не о переписке", () => {
    expect(upd).toContain("and not (_sa_tg_is_shifts(mt) and not _sa_tg_chat_link(msg->'reply_to_message')) then\n    return _sa_chat_tg_reply(msg);");
    expect(body("_sa_tg_chat_link")).toContain("where coalesce(b->'web_app'->>'url', b->>'url', '') ~ 'chat_\\d')");
    // как узнаёт ответ о переписке этап 38
    expect(rd("supabase/supabase-stage38-chat.sql")).toContain("where coalesce(b->'web_app'->>'url', b->>'url', '') ~ 'chat_\\d' limit 1;");
  });
  it("смены — словами и /smena; кто пишет — по напоминаниям или по входу через Telegram", () => {
    expect(upd).toContain("if _sa_tg_is_shifts(mt) and chat is not null then\n    emp := _sa_tg_emp(msg->'from'->>'id');");
    expect(upd).toContain("perform sa_tg_send(chat, _sa_tg_shifts_text(emp), 'Открыть график', 'schedule');");
    expect(upd).toContain("'Не узнаю этот Telegram. Открой приложение кнопкой ниже и войди: дальше бот будет тебя узнавать.', 'Открыть академию', null);");
    expect(upd).not.toMatch(/Этот Telegram не связан с приложением/);
    const emp = body("_sa_tg_emp");
    expect(emp).toContain("c := _sa_tg_caller(p_tg);");
    expect(emp).toContain("where a.tg_id = p_tg::bigint and not a.off and coalesce(x.status, 'active') = 'active';");
  });
  it("подсказки: /start и обычный текст — «смена» или /smena", () => {
    expect(upd).toContain("E'\\n\\nНапиши «смена» или /smena: пришлю твои ближайшие смены.'");
    expect(upd).toContain("Твои смены: напиши «смена» или /smena.");
    expect(upd).toContain("and _sa_tg_emp(p_update->'message'->'from'->>'id') is not null then");
  });
  it("служебные функции закрыты; шапка файла говорит, что после v99 файл перезапускают", () => {
    for (const f of ["_sa_tg_is_shifts(text)", "_sa_tg_emp(text)", "_sa_tg_chat_link(jsonb)"]) expect(SQL).toContain("revoke all on function " + f + " from public, anon, authenticated;");
    expect(SQL).toContain("--   • v100 (Доп. 413): смены и словами");
    expect(SQL).toContain("напоминаний. После v99 перезапусти этот файл.");
  });
});

describe("v100: тексты и документы", () => {
  it("гид: «напиши ему «смена»»", async () => {
    const { GUIDE } = await import("../ui/guide.jsx");
    const it2 = GUIDE.flatMap((s) => s.items).find((x) => x.key === "phonecal");
    expect(it2.text).toContain("Ближайшие смены пришлёт и бот: напиши ему «смена».");
  });
  it("README: test39 — 61 проверка; supabase/README — v100: перезапусти этап 39; CHANGES: Дополнение 413; «сборка v100»", () => {
    expect(rd("tools/claude/README.md")).toContain("# сообщение о переписке — в чат, вход через Telegram без напоминаний (61 проверка)");
    expect(rd("supabase/README.md")).toContain("v100: перезапусти `supabase-stage39-everyday.sql` ещё раз (SQL Editor → Run; функцию tg-bot и приложение трогать не");
    expect(rd("CHANGES.md")).toContain("# Дополнение 413 — «Смена» словами: бот присылает смены и без слеша (v100)");
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(100|10[1-9]|1[1-9]\d|[2-9]\d\d)<\/span>/);
  });
});
