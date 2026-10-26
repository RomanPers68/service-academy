// v92 (Доп. 405): свои чаты — руководитель и старший заводят чат с названием и выбранными коллегами своего заведения
// («Написать» → «Новый чат»); видят только участники; переименовать, добавить, убрать, очистить, удалить — руководитель
// и старший из участников; выйти может каждый; добавленному пишет бот. Сервер — этап 38 (tools/claude/sql/test38.sh),
// вид — tools/claude/e2e-v92.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const rd = (f) => readFileSync(f, "utf8");
const DASH = /[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g;
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");   // без комментариев: проверяем тексты экрана
const fnBody = (sql, name) => { const a = sql.indexOf("create or replace function " + name + "("); return a < 0 ? "" : sql.slice(a, sql.indexOf("end; $$;", a)); };

describe("v92: свои чаты на сервере (этап 38)", () => {
  const sql = rd("supabase/supabase-stage38-chat.sql");
  it("таблица участников закрыта; вид group; название и кто завёл", () => {
    expect(sql).toContain("create table if not exists sa_chat_members (\n  chat_id bigint not null references sa_chats(id) on delete cascade,");
    expect(sql).toContain("revoke all on table sa_chat_members from public, anon, authenticated;");
    expect(sql).toContain("alter table sa_chat_members enable row level security;");
    expect(sql).toContain("check (kind in ('team', 'leads', 'dm', 'net', 'group'))");
    expect(sql).toContain("alter table sa_chats add column if not exists title text;");
    expect(sql).toContain("alter table sa_chats add column if not exists created_by text;");
  });
  it("видят только участники (и только своего заведения); участники — из таблицы; в списке — после «Руководителей сети»", () => {
    expect(sql).toContain("returns boolean language sql stable security definer set search_path to public as $$\n  select ch.id is not null and c is not null and (");
    expect(sql).toContain("or (ch.kind = 'group' and exists (select 1 from sa_chat_members m where m.chat_id = ch.id and m.emp_id = (c->>'id'))))))");
    expect(sql).toContain("or (ch.kind = 'group' and exists (select 1 from sa_chat_members m where m.chat_id = ch.id and m.emp_id = e.id::text)))))");
    expect(sql).toContain("order by case x.kind when 'team' then 0 when 'leads' then 1 when 'net' then 2 when 'group' then 3 else 4 end,");
    expect(sql).toContain("'title', case when ch.kind = 'group' then ch.title end, 'owner', case when ch.kind = 'group' then ch.created_by end);");
  });
  it("завести — только руководитель и старший; коллеги своего заведения (без себя); до 100; 20 в сутки; бот добавленным", () => {
    const c = fnBody(sql, "chat_group_create");
    expect(c).toContain("if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");
    expect(c).toContain("if cardinality(who) > 100 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;");
    expect(c).toContain("x.created_at > now() - interval '1 day') >= 20 then");
    const pick = fnBody(sql, "_sa_chat_pick");
    expect(pick).toContain("e.id::text <> (c->>'id')");
    expect(pick).toContain("e.restaurant is not distinct from nullif(btrim(coalesce(c->>'restaurant', '')), '') and coalesce(e.status, 'active') = 'active'");
    expect(fnBody(sql, "_sa_chat_added")).toContain("' добавляет тебя в чат «' || coalesce(ch.title, 'Чат') || '»'");
    expect(fnBody(sql, "_sa_chat_added")).toContain("values (ch.id, e, top, now() - interval '1 day')");   // переписка до него — прочитана
    expect(sql).toContain("returns text language sql immutable as $$ select nullif(left(btrim(regexp_replace(coalesce(p, ''), '\\s+', ' ', 'g')), 40), '') $$;");
  });
  it("поправить и удалить — руководитель и старший из участников; себя убрать нельзя (для этого «Выйти»); вышел последний — чата нет", () => {
    const e = fnBody(sql, "chat_group_edit");
    expect(e).toContain("if ch.id is null or ch.kind <> 'group' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;");
    expect(e).toContain("if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");
    expect(e).toContain("delete from sa_chat_members m where m.chat_id = ch.id and m.emp_id = any(p_remove) and m.emp_id <> (c->>'id');");
    expect(fnBody(sql, "chat_group_leave")).toContain("if not exists (select 1 from sa_chat_members where chat_id = ch.id) then delete from sa_chats where id = ch.id; end if;");
    expect(fnBody(sql, "chat_group_delete")).toContain("delete from sa_chats where id = ch.id;");
  });
  it("в своём чате закреп, чужое и «Очистить» — руководитель и старший; ответ — бот с названием чата; функции с токеном — VOLATILE", () => {
    expect(sql).toContain("if ch.kind in ('team', 'group') and not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");
    expect(sql).toContain("and ch.kind in ('team', 'leads', 'group'))\n                                   or (coalesce((c->>'network')::boolean, false) and ch.kind = 'net')) then");
    expect(fnBody(sql, "chat_clear")).toContain("and ch.kind in ('team', 'leads', 'group'))");
    expect(sql).toContain("when 'group' then coalesce(ch.title, 'Чат') else 'Руководители сети' end || '»:'");
    for (const f of ["chat_group_create", "chat_group_edit", "chat_group_leave", "chat_group_delete"]) expect([f, fnBody(sql, f).includes("language plpgsql volatile security definer")]).toEqual([f, true]);
    expect(sql).toContain("' функций из 20 · таблицы: '");
  });
});

describe("v92: свои чаты в приложении", () => {
  it("кто может: завести — руководитель и старший; управлять — они же в своём чате; закреп, чужое, очистить — тоже", async () => {
    const C = await import("../lib/chat.js");
    const lead = { id: "m", lead: true }, waiter = { id: "a", lead: false }, g = { kind: "group" };
    expect([C.canGroup(lead), C.canGroup(waiter), C.canGroup(null)]).toEqual([true, false, false]);
    expect([C.canManage(g, lead), C.canManage(g, waiter), C.canManage({ kind: "team" }, lead)]).toEqual([true, false, false]);
    expect([C.canPin(g, lead), C.canPin(g, waiter), C.canDelOthers(g, lead), C.canDelOthers(g, waiter), C.canClear(g, lead), C.canClear(g, waiter)]).toEqual([true, false, true, false, true, false]);
    expect([C.groupTitle("  Бар   и  веранда "), C.groupTitle("x".repeat(60)).length, C.groupTitle(null)]).toEqual(["Бар и веранда", 40, ""]);
  });
  it("API: завести, поправить, выйти, удалить", async () => {
    const { chatApi } = await import("../lib/chat-api.js");
    const seen = [];
    const api = chatApi((fn, args) => { seen.push([fn, args]); return Promise.resolve({ ok: true }); });
    await api.groupCreate("Бар", [5, "e-ilya"]);
    await api.groupEdit(7, { title: "Бар и веранда" });
    await api.groupEdit(7, { add: [3], remove: ["e-anna"] });
    await api.groupLeave(7); await api.groupDelete(7);
    expect(seen).toEqual([["chat_group_create", { p_title: "Бар", p_emps: ["5", "e-ilya"] }], ["chat_group_edit", { p_chat: 7, p_title: "Бар и веранда", p_add: null, p_remove: null }],
      ["chat_group_edit", { p_chat: 7, p_title: null, p_add: ["3"], p_remove: ["e-anna"] }], ["chat_group_leave", { p_chat: 7 }], ["chat_group_delete", { p_chat: 7 }]]);
  });
  it("экран: «Новый чат» в «Написать» — руководителю и старшему; название, галочки, «Создать чат · N человек»; шапка своего чата — участники", () => {
    const src = rd("ui/chat.jsx");
    expect(src).toContain("const newRow = canGroup(me) ? (");
    expect(src).toContain('<span className="ch-person-n">Новый чат</span><span className="ch-person-p">название и несколько коллег</span>');
    expect(src).toContain('{busy ? "Создаю…" : !t ? "Дай чату название" : !sel.size ? "Отметь коллег" : "Создать чат · " + peopleWord(sel.size + 1)}');
    expect(src).toContain('hint="Чат видят только его участники. Добавлять и убирать людей, переименовать и удалить чат могут руководитель и старший."');
    expect(src).toContain('{multi ? <span className={"ch-tick" + (on ? " on" : "")} aria-hidden="true">{on ? IC.check : null}</span> : null}');
    expect(src).toContain('emptyText="Все коллеги уже в этом чате."');
    expect(src).toContain('<button type="button" className="ch-who ch-whob" data-chat-info=""');
    expect(src).toContain('{sure === "leave" ? "Точно выйти? Нажми ещё раз" : "Выйти из чата"}');
    expect(src).toContain('{sure === "delete" ? "Удалить у всех? Нажми ещё раз" : "Удалить чат"}');
    expect(src).toContain('String(p.id) === String(chat.owner) ? "создатель чата" : ""');
    for (const f of ["function GroupNew(", "function GroupAdd(", "function GroupInfo("]) {
      const a = src.indexOf(f), part = code(src.slice(a, src.indexOf("\n}\n", a)));
      expect([f, part.match(DASH)]).toEqual([f, null]);
    }
  });
  it("чат удалили или меня убрали — переписка закрывается сама, над списком — почему", () => {
    const src = rd("ui/chat.jsx");
    expect(src).toContain('if (r && r.error === "not_found") { if (onGone) onGone("gone"); return; }');
    expect(src).toContain('setNote(why === "left" ? "Ты больше не в этом чате." : why === "deleted" ? "Чат удалён у всех." : "Этого чата у тебя больше нет: его удалили или тебя убрали из участников.");');
    expect(src).toContain('{note ? <div className="ch-empty" role="status" data-chat-note="">{note}</div> : null}');
  });
  it("аватар своего чата — буквы названия; справка про «Новый чат» без «слово — слово»", async () => {
    const src = rd("ui/chat.jsx");
    expect(src).toContain('? <span className={"ch-ava team" + (big ? " big" : "")} aria-hidden="true">{chatInitials(c.title || "Чат")}</span>');
    const { GUIDE } = await import("../ui/guide.jsx");
    const g = GUIDE.flatMap((x) => x.items || []).find((x) => x.key === "chat") || {};
    expect(g.text).toContain("Руководитель и старший могут завести свой чат: «Написать» → «Новый чат», название и галочки у коллег");
    expect(g.text.match(DASH)).toBe(null);
  });
  it("демо: свои чаты на демо-сервере; ответы в своём чате — только от участников", async () => {
    const { demoApi } = await import("../tools/claude/chat-demo/demo-api.js");
    const api = demoApi();
    const r = await api.groupCreate("  Бар ", ["p3", "p4", "me", "нет такого"]);
    expect([r.ok, r.chat.kind, r.chat.title, r.members.map((m) => m.id).join(",")]).toEqual([true, "group", "Бар", "me,p3,p4"]);
    expect((await api.list()).chats.map((c) => c.kind)).toEqual(["team", "leads", "net", "group", "dm", "dm"]);
    const e = await api.groupEdit(r.chat.id, { title: "Бар и веранда", add: ["p5"], remove: ["p3"] });
    expect([e.chat.title, e.members.map((m) => m.id).join(",")]).toEqual(["Бар и веранда", "me,p4,p5"]);
    expect((await api.groupDelete(r.chat.id)).ok).toBe(true);
    expect((await api.list()).chats.some((c) => c.kind === "group")).toBe(false);
    expect(rd("tools/claude/chat-demo/demo-api.js")).toContain('if (c.kind === "group") {   // v92: в своём чате отвечают только его участники');
  });
});

describe("v92: документы", () => {
  it("README: e2e-v92, test38 — 124 проверки; supabase/README — v92; CHANGES: Дополнение 405; «сборка v92»", () => {
    const readme = rd("tools/claude/README.md");
    expect(readme).toContain("`e2e-v92.mjs` — v92 (Доп. 405)");
    expect(readme).toContain("124 проверки");
    expect(rd("supabase/README.md")).toContain("v92: перезапусти `supabase-stage38-chat.sql`");
    expect(rd("CHANGES.md")).toContain("# Дополнение 405 — Свои чаты с выбором участников (v92)");
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(9[2-9]|\d{3,})<\/span>/);
  });
});
