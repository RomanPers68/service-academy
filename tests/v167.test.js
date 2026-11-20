// v167 (Доп. 492): редактор справочника, часть первая. Владелец (15.11): «Мы можем сделать редактор справочника по типу
// как в меню, карте бара, контента и т.д.? Уверен, что инфа будет добавляться и хочется это делать с приложения.
// Редактор должен быть гибким и удобным. Включая все фишки и ai-ассистента». Его решения: справочник общий для всех
// заведений; править можно всё, включая штатные главы; редактор только у владельца. Ассистент — следующей версией.
//   • сервер — этап 53 (supabase-stage53-ref-book.sql): хранятся только правки, читают все, пишет владелец;
//   • lib/ref-book.js — память, копия на телефоне, слияние штатного с правками, дерево для редактора;
//   • справочник, поиск, «глава дня», карточки в чате и Наставник видят справочник с правками;
//   • ui/ref-editor.jsx — экран редактора: разделы → раздел → глава.
// Без этапа 53 всё как раньше. Разметки JSX в файле нет (Доп. 482). Вид в браузере — tools/claude/e2e-v167.mjs,
// сервер на настоящем Postgres — tools/claude/sql/test53.sh.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const store0 = {};
const phone = { getItem: (k) => (k in store0 ? store0[k] : null), setItem: (k, v) => { store0[k] = String(v); }, removeItem: (k) => { delete store0[k]; } };
globalThis.localStorage = phone;
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import {
  RB_CACHE, RB_CACHE_MAX, RB_FIXED, RB_LIMITS, RB_FRESH, isOwnSec, isOwnCh, normRefItems, refBookNow, refItemsNow, loadRefBook, refreshRefBook, _resetRefBook,
  mergeRefBook, mergeRefIndex, REF_PHOTO_RE, refPhotoIds, refPlain,
} from "../lib/ref-book";
import {
  newRefId, newRefPhotoId, applyRefEdit, saveRefBook, refBookErr, refEditTree, reorderPut, chapterRow, refRow, refRowEmpty, sameText,
  REF_MARKS, refFmt, refInsertLine, refPhotoLine,
} from "../lib/ref-edit";
import { REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE, REFERENCE_APP_COURSE } from "../data/reference";
import { REFERENCE_DAILY_INDEX } from "../data/reference-index";
import { referenceDailyTask } from "../ui/reference-daily";
import { ReferenceSection, RefContent, hubCards, REF_OFF_HUB } from "../ui/ReferenceSection";
import { RefEditorScreen, RE_BASE, RE_DRAFT, ILL_NAMES, illKeys, chapterDraft } from "../ui/ref-editor";
import { ILL } from "../ui/reference-illustrations";
import { aheadPlan, _resetLessonPhotos, loadLessonPhotos } from "../lib/lesson-photo";
import { setPhotoBackend, memoryBackend } from "../lib/photo-store";
import { STAGES } from "../lib/server-check";
import { S, A } from "../ui/styles";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html) => html.replace(/<[^>]+>/g, "");
const count = (s, part) => s.split(part).length - 1;
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const noop = () => {};
// лист рисуется поверх экрана (портал); на сервере портала нет — рисуем без документа, как в tests/v157
const noDoc = (fn) => { const d = globalThis.document; delete globalThis.document; try { return fn(); } finally { globalThis.document = d; } };

const BASE = [REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE, REFERENCE_APP_COURSE];
const row = (id, kind, more = {}) => ({ id, kind, parent: "", title: null, sub: null, body: null, hidden: false, sort: null, ...more });
const ids = (c) => c.lessons.map((l) => l.id);

// ── сервер в памяти (тот же, что в демо) и «телефон» ─────────────────────────────────────────────────────────
const R0 = "Два моря, Океан";
const PEOPLE = [
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
  { id: "u-maria", name: "Мария", surname: "Орлова", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
];
const TOK = { tr: "u-roman", tm: "u-maria", ta: "e-anna" };
const ROMAN = PEOPLE[0], ANNA = PEOPLE[2];
const mk = (more = {}) => makeServer({ today: "2026-11-16", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, ...more });
let calls = [], failOn = null, SRV = null;
const useServer = (srv) => {
  globalThis.fetch = async (u, init = {}) => {
    const fn = String(u).split("/rpc/")[1], body = JSON.parse(init.body || "{}");
    calls.push([fn, body]);
    if (failOn && failOn(fn, body)) throw new Error("нет связи");
    return { ok: true, status: 200, json: async () => srv.rpc(fn, body) };
  };
};
const fresh = (more = {}, tok = "tr") => {
  for (const k of Object.keys(store0)) delete store0[k];
  setPhotoBackend(memoryBackend()); _resetLessonPhotos(); _resetRefBook(); calls = []; failOn = null;
  SRV = mk(more); useServer(SRV); phone.setItem("sa_session_token", tok);
  return SRV;
};
const bookCalls = () => calls.filter((c) => c[0] === "ref_book");

describe("v167 · версия и журнал", () => {
  it("сборка v167, Дополнение 492, слова владельца, сценарий в браузере и проверка сервера", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(167);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 492 — .*\(v167\)/);
    const part = c.slice(c.indexOf("# Дополнение 492"));
    const flat = part.replace(/\s+/g, " ");
    expect(flat).toContain("редактор справочника по типу как в меню");
    expect(flat).toContain("хочется это делать с приложения");
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v167.mjs");
    expect(existsSync("tools/claude/sql/test53.sh")).toBe(true);
  });
});

describe("v167 · 1: этап 53 на сервере (supabase-stage53-ref-book.sql)", () => {
  const q = rd("supabase/supabase-stage53-ref-book.sql");
  it("две функции, таблицы закрыты, права — этапа 21, файл можно запускать повторно", () => {
    expect(q).toContain("create table if not exists sa_ref_items");
    expect(q).toContain("create table if not exists sa_ref_meta");
    expect(count(q, "enable row level security")).toBe(2);
    expect(q).not.toMatch(/create policy/i);
    for (const fn of ["ref_book(p_token text, p_have text default null)", "ref_book_save(p_token text, p_items jsonb default '[]'::jsonb, p_del jsonb default '[]'::jsonb)"]) {
      expect(q).toContain("create or replace function " + fn);
    }
    expect(count(q, "security definer set search_path to public")).toBe(2);
    expect(q).toContain("revoke all on function ref_book(text, text), ref_book_save(text, jsonb, jsonb) from public;");
    expect(q).toContain("grant execute on function ref_book(text, text), ref_book_save(text, jsonb, jsonb) to anon, authenticated;");
    expect(q).toContain("notify pgrst, 'reload schema';");
    expect(q).toContain("to_regprocedure('public._sa_caller(text)') is null");
    expect(q).not.toMatch(/drop table/i);
  });
  it("пишет только владелец; читают все, кто вошёл; правка проверяется целиком до записи", () => {
    const save = q.slice(q.indexOf("create or replace function ref_book_save"));
    expect(save).toContain("if coalesce((c->>'admin')::boolean, false) is not true then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");
    expect(save.indexOf("'bad_item'")).toBeLessThan(save.indexOf("delete from sa_ref_items"));
    expect(save.indexOf("'too_many'")).toBeLessThan(save.indexOf("delete from sa_ref_items"));
    expect(save).toContain("i.kind = 'ch' and i.parent like 'rs-%'");   // свой раздел убирают вместе с его главами
    const read = q.slice(q.indexOf("create or replace function ref_book("), q.indexOf("create or replace function ref_book_save"));
    expect(read).not.toContain("forbidden");
    expect(read).toContain("'same', true");
  });
  it("этап есть в списке владельца («Сервер») и в памятке", () => {
    expect(STAGES.find((x) => x.n === "53")).toEqual({ n: "53", file: "supabase-stage53-ref-book.sql", what: "Редактор справочника", fn: "ref_book" });   // v180: последний — 54
    const rm = rd("supabase/README.md");
    expect(rm).toContain("| 62 | `supabase-stage53-ref-book.sql` | **Редактор справочника** (v167)");
    expect(rm).toContain("### Этап 53 (v167) — редактор справочника");
    expect(rm).toContain("редактор справочника: 2 функции из 2");
    expect(refBookErr("missing")).toContain("supabase-stage53-ref-book.sql");
  });
});

describe("v167 · 1: сервер в памяти повторяет этап 53 (tools/claude/demo-app/fake-server.js)", () => {
  const P = (tok, more) => ({ p_token: tok, ...more });
  it("пусто: версия 0, правок нет; править может только владелец", () => {
    const srv = mk();
    expect(srv.rpc("ref_book", P("ta"))).toEqual({ ok: true, ver: "0", items: [], can: { edit: false } });
    expect(srv.rpc("ref_book", P("tm")).can).toEqual({ edit: false });
    expect(srv.rpc("ref_book", P("tr")).can).toEqual({ edit: true });
    expect(srv.rpc("ref_book", P("нет"))).toEqual({ ok: false, error: "auth" });
    expect(srv.rpc("ref_book_save", P("ta", { p_items: [row("rs-a", "sec", { title: "X" })], p_del: [] }))).toEqual({ ok: false, error: "forbidden" });
    expect(srv.rpc("ref_book_save", P("tm", { p_items: [row("rs-a", "sec", { title: "X" })], p_del: [] }))).toEqual({ ok: false, error: "forbidden" });
    expect(srv.rpc("ref_book", P("ta")).items).toEqual([]);
  });
  it("запись растит версию; с той же версией ответ короткий; строка заменяется целиком", () => {
    const srv = mk();
    expect(srv.rpc("ref_book_save", P("tr", { p_items: [row("rs-a", "sec", { title: "Стандарты", sub: "Наши правила" }), row("rc-b", "ch", { parent: "rs-a", title: "Встреча", body: "Текст" })], p_del: [] }))).toEqual({ ok: true, ver: "1" });
    const all = srv.rpc("ref_book", P("ta"));
    expect(all.ver).toBe("1");
    expect(all.items.map((x) => [x.id, x.kind, x.parent, x.title, x.sub, x.body, x.hidden, x.sort])).toEqual([["rs-a", "sec", "", "Стандарты", "Наши правила", null, false, null], ["rc-b", "ch", "rs-a", "Встреча", null, "Текст", false, null]]);
    expect(srv.rpc("ref_book", P("ta", { p_have: "1" }))).toEqual({ ok: true, ver: "1", same: true, can: { edit: false } });
    expect(srv.rpc("ref_book", P("ta", { p_have: "0" })).items.length).toBe(2);
    expect(srv.rpc("ref_book_save", P("tr", { p_items: [row("rc-b", "ch", { parent: "rs-a", title: "Встреча гостя", hidden: true, sort: 20 })], p_del: [] })).ver).toBe("2");
    const b = srv.rpc("ref_book", P("ta")).items.find((x) => x.id === "rc-b");
    expect([b.title, b.body, b.hidden, b.sort]).toEqual(["Встреча гостя", null, true, 20]);   // текст не прислали — его в строке больше нет
  });
  it("убрать: свой раздел уходит вместе со своими главами; строку штатного убирают, чтобы вернуть как было", () => {
    const srv = mk();
    srv.rpc("ref_book_save", P("tr", { p_items: [row("rs-a", "sec", { title: "Свой" }), row("rc-1", "ch", { parent: "rs-a", title: "Г1", body: "т" }), row("srv-types", "ch", { parent: "rs-a", title: "Перенесённая" }),
      row("wine", "sec", { title: "Вино" }), row("win-temp", "ch", { hidden: true })], p_del: [] }));
    expect(srv.rpc("ref_book_save", P("tr", { p_items: [row("srv-types", "ch", { title: "Перенесённая" })], p_del: ["rs-a", "wine"] })).ok).toBe(true);
    expect(srv.rpc("ref_book", P("ta")).items.map((x) => x.id).sort()).toEqual(["srv-types", "win-temp"]);   // штатная глава вернулась домой со своей правкой
    expect(srv.rpc("ref_book", P("ta")).items.find((x) => x.id === "srv-types").parent).toBe("");
  });
  it("плохую правку не берёт ни по частям, ни целиком", () => {
    const srv = mk();
    const bad = (items, del = []) => srv.rpc("ref_book_save", P("tr", { p_items: items, p_del: del }));
    expect(bad([row("rs-a", "sec", { title: "Хорошая" }), row("плохой номер", "ch")])).toMatchObject({ ok: false, error: "bad_item" });
    expect(bad([row("rs-a", "раздел")]).error).toBe("bad_item");
    expect(bad([row("rs-a", "sec", { title: "т".repeat(161) })]).error).toBe("bad_item");
    expect(bad([row("rs-a", "sec", { sub: "т".repeat(241) })]).error).toBe("bad_item");
    expect(bad([row("rc-a", "ch", { body: "т".repeat(60001) })]).error).toBe("bad_item");
    expect(bad([row("rc-a", "ch", { sort: "первый" })]).error).toBe("bad_item");
    expect(bad([], [5]).error).toBe("bad_item");
    expect(bad("строка").error).toBe("bad_request");
    expect(bad(Array.from({ length: 401 }, (_, i) => row("rc-" + i, "ch"))).error).toBe("too_many");
    expect(srv.rpc("ref_book", P("ta"))).toMatchObject({ ver: "0", items: [] });   // ничего не легло, версия не выросла
    for (let k = 0; k < 2; k++) expect(bad(Array.from({ length: 400 }, (_, i) => row("rc-" + k + "-" + i, "ch", { parent: "rs-a", title: "Г", body: "т" }))).ok).toBe(true);
    expect(bad([row("rc-last", "ch", { title: "801-я" })]).error).toBe("too_many");
    expect(bad([row("rc-last", "ch", { title: "вместо убранной" })], ["rc-0-0"]).ok).toBe(true);
  });
  it("нет этапа 53 — «нет такой функции»; в проверке сервера владельца функции тоже нет", () => {
    const srv = mk({ noStage53: true });
    expect(srv.rpc("ref_book", P("ta")).code).toBe("PGRST202");
    expect(srv.rpc("ref_book_save", P("tr", { p_items: [], p_del: [] })).code).toBe("PGRST202");
    expect(srv.rpc("server_check", P("tr", { p_fns: ["ref_book", "staff_photos"], p_buckets: [] })).fns).toEqual(["staff_photos"]);
    expect(mk().rpc("server_check", P("tr", { p_fns: ["ref_book"], p_buckets: [] })).fns).toEqual(["ref_book"]);
  });
  it("правки примера (opts.refBook) — версия 1", () => {
    const srv = mk({ refBook: [row("rs-a", "sec", { title: "Свой" }), { id: "мусор", kind: "sec" }] });
    expect(srv.rpc("ref_book", P("ta"))).toMatchObject({ ver: "1", items: [{ id: "rs-a" }] });
  });
});

describe("v167 · 2: правки на телефоне (lib/ref-book.js)", () => {
  beforeEach(() => { fresh(); });
  it("номера своего: раздел rs-…, глава rc-…, фото rp:…; годятся серверу", () => {
    const a = newRefId("sec"), b = newRefId("ch"), c = newRefPhotoId();
    expect([isOwnSec(a), isOwnCh(a), isOwnSec(b), isOwnCh(b)]).toEqual([true, false, false, true]);
    for (const id of [a, b, c]) expect(id).toMatch(/^[A-Za-z0-9_.:-]{1,60}$/);
    expect(c.startsWith("rp:")).toBe(true);
    expect(newRefId("ch")).not.toBe(newRefId("ch"));
    expect([isOwnSec("serving"), isOwnCh("srv-basics"), isOwnSec(null)]).toEqual([false, false, false]);
    expect(RB_FIXED).toEqual(["app"]);
    expect(RB_LIMITS).toEqual({ title: 160, sub: 240, body: 60000, rows: 800 });
  });
  it("строки с сервера: только годные, без повторов", () => {
    expect(normRefItems([{ id: "rs-a", kind: "sec", title: "А", sort: 12.4 }, { id: "rs-a", kind: "sec", title: "повтор" }, { id: "плохой номер", kind: "ch" }, { id: "rc-x", kind: "другое" },
      null, { id: "rc-b", kind: "ch", parent: "rs-a", body: "", hidden: true, sort: "5" }]))
      .toEqual([{ id: "rs-a", kind: "sec", parent: "", title: "А", sub: null, body: null, hidden: false, sort: 12 }, { id: "rc-b", kind: "ch", parent: "rs-a", title: null, sub: null, body: "", hidden: true, sort: null }]);
    expect(normRefItems("нет")).toEqual([]);
  });
  it("первый заход: правок нет, запрос один; второй раз за заход сервер не спрашиваем", async () => {
    expect(refBookNow()).toMatchObject({ ver: "0", items: [], loaded: false, missing: false });
    const b = await loadRefBook();
    expect(b).toMatchObject({ ver: "0", items: [], loaded: true, can: true });
    await loadRefBook(); await Promise.all([loadRefBook(), loadRefBook()]);
    expect(bookCalls().length).toBe(1);
    expect(bookCalls()[0][1]).toEqual({ p_token: "tr", p_have: null });
  });
  it("запись: правка сразу в памяти и на телефоне; после перезапуска телефон называет свою версию и получает короткий ответ", async () => {
    await loadRefBook();
    const r = await saveRefBook([row("rs-a", "sec", { title: "Стандарты" }), row("rc-b", "ch", { parent: "rs-a", title: "Встреча", body: "Текст" })], []);
    expect(r).toEqual({ ok: true, ver: "1" });
    expect(refItemsNow().map((x) => x.id)).toEqual(["rs-a", "rc-b"]);
    expect(JSON.parse(store0[RB_CACHE])).toMatchObject({ ver: "1", items: [{ id: "rs-a" }, { id: "rc-b" }] });
    _resetRefBook(); calls = [];
    expect(refBookNow()).toMatchObject({ ver: "1", loaded: false });   // с телефона, сервер ещё не спрашивали
    expect(refItemsNow().length).toBe(2);
    const b = await loadRefBook();
    expect(bookCalls()[0][1]).toEqual({ p_token: "tr", p_have: "1" });
    expect(b).toMatchObject({ ver: "1", loaded: true });
    expect(b.items.length).toBe(2);
  });
  it("другой телефон: сотрудник получает правки владельца; править не может", async () => {
    await saveRefBook([row("rs-a", "sec", { title: "Стандарты" })], []);
    for (const k of Object.keys(store0)) delete store0[k];
    _resetRefBook(); phone.setItem("sa_session_token", "ta");
    const b = await loadRefBook();
    expect(b).toMatchObject({ ver: "1", can: false, loaded: true });
    expect(b.items[0]).toMatchObject({ id: "rs-a", title: "Стандарты" });
    expect(await saveRefBook([row("rs-b", "sec", { title: "Чужой" })], [])).toEqual({ ok: false, error: "forbidden" });
    expect(refItemsNow().map((x) => x.id)).toEqual(["rs-a"]);
  });
  it("нет этапа 53: правок нет, копия на телефоне стёрта, запись говорит «missing»", async () => {
    phone.setItem(RB_CACHE, JSON.stringify({ ver: "3", items: [row("rs-a", "sec", { title: "Старое" })] }));
    SRV = mk({ noStage53: true }); useServer(SRV); _resetRefBook();
    expect(refItemsNow().length).toBe(1);
    const b = await loadRefBook();
    expect(b).toMatchObject({ missing: true, loaded: true, items: [] });
    expect(store0[RB_CACHE]).toBeUndefined();
    expect(await saveRefBook([row("rs-a", "sec", { title: "X" })], [])).toEqual({ ok: false, error: "missing" });
    await refreshRefBook(0);
    expect(bookCalls().length).toBe(1);   // этапа нет — повторно за заход не спрашиваем
  });
  it("нет связи: остаётся то, что на телефоне; запись — «net»; не вошёл — «auth»", async () => {
    phone.setItem(RB_CACHE, JSON.stringify({ ver: "3", items: [row("rs-a", "sec", { title: "С телефона" })] }));
    _resetRefBook(); failOn = () => true;
    const b = await loadRefBook();
    expect(b).toMatchObject({ ver: "3", loaded: false });
    expect(b.items[0].title).toBe("С телефона");
    expect((await saveRefBook([row("rs-b", "sec", { title: "X" })], [])).ok).toBe(false);
    phone.removeItem("sa_session_token");
    expect(await saveRefBook([], [])).toEqual({ ok: false, error: "auth" });
    for (const c of ["missing", "forbidden", "auth", "too_many", "bad_item", "net", "что-то"]) expect(refBookErr(c).length).toBeGreaterThan(20);
    for (const c of ["missing", "forbidden", "auth", "too_many", "bad_item", "net"]) expect(refBookErr(c)).not.toMatch(/ — /);
  });
  it("справочник открыли — спрашиваем сервер снова, если спрашивали давно (правку владельца видно без перезапуска)", async () => {
    await loadRefBook();
    await refreshRefBook();   // только что спрашивали
    expect(bookCalls().length).toBe(1);
    SRV.rpc("ref_book_save", { p_token: "tr", p_items: [row("rs-a", "sec", { title: "Новый" })], p_del: [] });
    const b = await refreshRefBook(0);
    expect(bookCalls().length).toBe(2);
    expect(b.items.map((x) => x.id)).toEqual(["rs-a"]);
    expect(RB_FRESH).toBe(60000);
    expect(rd("ui/ReferenceSection.jsx")).toContain("R.useEffect(() => { refreshRefBook(); }, []);");
  });
  it("копия на телефоне — пока правки умещаются в меру: память телефона общая с остальным приложением", async () => {
    await loadRefBook();
    await saveRefBook([row("rs-a", "sec", { title: "Малый" })], []);
    expect(JSON.parse(store0[RB_CACHE]).items.length).toBe(1);
    const big = Array.from({ length: 30 }, (_, i) => row("rc-big" + i, "ch", { parent: "rs-a", title: "Г" + i, body: "т".repeat(55000) }));
    expect((await saveRefBook(big, [])).ok).toBe(true);
    expect(JSON.stringify({ ver: "2", items: refItemsNow() }).length).toBeGreaterThan(RB_CACHE_MAX);
    expect(store0[RB_CACHE]).toBeUndefined();   // копию не держим — правки придут с сервера при запуске
    expect(refItemsNow().length).toBe(31);       // в памяти они есть
    _resetRefBook();
    expect(refItemsNow()).toEqual([]);
    expect((await loadRefBook()).items.length).toBe(31);
    expect(RB_CACHE_MAX).toBe(1500000);
  });
  it("правка, приложенная к списку: убрать, заменить, добавить; свой раздел — вместе с главами", () => {
    const list = [row("rs-a", "sec", { title: "А" }), row("rc-1", "ch", { parent: "rs-a", title: "1" }), row("srv-types", "ch", { parent: "rs-a" }), row("wine", "sec", { title: "Вино" })];
    expect(applyRefEdit(list, [row("wine", "sec", { title: "Вина мира" }), row("rs-b", "sec", { title: "Б" })], ["rs-a"]).map((x) => [x.id, x.title]))
      .toEqual([["wine", "Вина мира"], ["rs-b", "Б"]]);
    expect(applyRefEdit(list, [row("srv-types", "ch", { title: "Домой" })], ["rs-a"]).map((x) => x.id)).toEqual(["wine", "srv-types"]);
    expect(applyRefEdit(null, null, null)).toEqual([]);
  });
});

describe("v167 · 2: слияние штатного справочника с правками (mergeRefBook)", () => {
  it("правок нет — те же объекты: справочник как раньше", () => {
    const out = mergeRefBook(BASE, []);
    expect(out.length).toBe(5);
    out.forEach((c, i) => expect(c).toBe(BASE[i]));
    expect(mergeRefBook(BASE, null)).toEqual(BASE);
    expect(mergeRefBook(null, [])).toEqual([]);
  });
  it("нетронутый раздел остаётся тем же объектом, тронутый — новым; штатные данные не портятся", () => {
    const before = JSON.stringify(BASE);
    const out = mergeRefBook(BASE, [row("win-temp", "ch", { title: "Температура" })]);
    expect(out[0]).toBe(REFERENCE_COURSE);
    expect(out[1]).not.toBe(REFERENCE_WINE_COURSE);
    expect(out[1].lessons.find((l) => l.id === "win-temp")).toMatchObject({ title: "Температура", changed: true, content: REFERENCE_WINE_COURSE.lessons.find((l) => l.id === "win-temp").content });
    expect(out[1].lessons.find((l) => l.id === "win-etiquette")).toBe(REFERENCE_WINE_COURSE.lessons[0]);
    expect(JSON.stringify(BASE)).toBe(before);
  });
  it("свой раздел со своей главой — в конце; пустой свой раздел и скрытое команда не видит", () => {
    const items = [row("rs-a", "sec", { title: "Стандарты", sub: "Наши правила" }), row("rc-1", "ch", { parent: "rs-a", title: "Встреча гостя", body: "Текст главы" }),
      row("rs-empty", "sec", { title: "Пустой" }), row("rs-hid", "sec", { title: "Скрытый", hidden: true }), row("rc-2", "ch", { parent: "rs-hid", title: "В скрытом", body: "т" }),
      row("rc-3", "ch", { parent: "rs-a", title: "Скрытая глава", body: "т", hidden: true }), row("rc-lost", "ch", { parent: "rs-нет", title: "Без раздела", body: "т" })];
    const out = mergeRefBook(BASE, items);
    expect(out.map((c) => c.id)).toEqual(["serving", "wine", "coffee", "bar", "app", "rs-a"]);
    const own = out[5];
    expect(own).toMatchObject({ id: "rs-a", title: "Стандарты", subtitle: "Наши правила", own: true });
    expect(own.lessons).toEqual([{ id: "rc-1", title: "Встреча гостя", type: "lesson", content: "Текст главы", own: true }]);
    const all = mergeRefBook(BASE, items, { all: true });
    expect(all.map((c) => c.id)).toEqual(["serving", "wine", "coffee", "bar", "app", "rs-a", "rs-empty", "rs-hid"]);
    expect(all[5].lessons.map((l) => [l.id, !!l.hidden])).toEqual([["rc-1", false], ["rc-3", true]]);
    expect(all[7]).toMatchObject({ hidden: true });
  });
  it("штатное: своё название и текст, скрыть главу и раздел, свой порядок", () => {
    const out = mergeRefBook(BASE, [row("serving", "sec", { title: "Сервировка стола", sub: "Коротко" }), row("srv-basics", "ch", { body: "Новый текст" }), row("srv-types", "ch", { hidden: true }),
      row("srv-schools", "ch", { sort: 5 }), row("coffee", "sec", { hidden: true }), row("wine", "sec", { sort: 5 })]);
    expect(out.map((c) => c.id)).toEqual(["wine", "serving", "bar", "app"]);
    const s = out[1];
    expect(s).toMatchObject({ title: "Сервировка стола", subtitle: "Коротко", changed: true });
    expect(ids(s)).toEqual(["srv-schools", "srv-basics", "srv-plates", "srv-cutlery", "srv-glasses"]);
    expect(s.lessons[1]).toMatchObject({ title: REFERENCE_COURSE.lessons[0].title, content: "Новый текст", changed: true });
    expect(out[0].title).toBe(REFERENCE_WINE_COURSE.title);
  });
  it("штатную главу можно перенести в другой раздел, свою — тоже; раздел, оставшийся без глав, не показывается", () => {
    const items = [row("rs-a", "sec", { title: "Свой" }), row("srv-types", "ch", { parent: "rs-a" }), row("rc-1", "ch", { parent: "wine", title: "О винах", body: "т", sort: 15 }),
      ...REFERENCE_COFFEE_COURSE.lessons.map((l) => row(l.id, "ch", { parent: "rs-a" }))];
    const out = mergeRefBook(BASE, items);
    expect(out.map((c) => c.id)).toEqual(["serving", "wine", "bar", "app", "rs-a"]);
    expect(ids(out[0])).not.toContain("srv-types");
    expect(ids(out[1]).slice(0, 3)).toEqual(["win-etiquette", "rc-1", "win-temp"]);
    // перенесённые без своего места встают по месту из родного раздела (при равенстве — по номеру): расстановку дальше правит владелец
    expect(ids(out[4])).toEqual(["cof-bean", "cof-espresso", "srv-types", "cof-milk", "cof-classic", "cof-alt", "cof-care", "cof-story"]);
    // раздела-адресата нет (его убрали) — глава остаётся дома
    expect(ids(mergeRefBook(BASE, [row("srv-types", "ch", { parent: "rs-нет", title: "Дома" })])[0])).toContain("srv-types");
  });
  it("«Гид по приложению» не правится: строки про него не действуют, главу в него не перенести", () => {
    const out = mergeRefBook(BASE, [row("app", "sec", { title: "Мой гид", hidden: true }), row("app-start", "ch", { title: "Переписано", hidden: true }), row("rc-1", "ch", { parent: "app", title: "В гид", body: "т" }),
      row("srv-types", "ch", { parent: "app" })]);
    expect(out[4]).toBe(REFERENCE_APP_COURSE);
    expect(ids(out[0])).toContain("srv-types");
    expect(JSON.stringify(out)).not.toContain("В гид");
  });
  it("лёгкий индекс глав («глава дня», карточки в чате): названия свои, скрытое убрано, свои главы добавлены", () => {
    expect(mergeRefIndex(REFERENCE_DAILY_INDEX, [])).toBe(REFERENCE_DAILY_INDEX);
    for (const e of REFERENCE_DAILY_INDEX) expect(typeof e.cid, e.id).toBe("string");
    expect(REFERENCE_DAILY_INDEX.find((e) => e.id === "srv-basics")).toMatchObject({ cid: "serving", course: "Сервировка" });
    expect(rd("lib/reference-index-build.js")).toContain("cid: c.id");
    const idx = mergeRefIndex(REFERENCE_DAILY_INDEX, [row("serving", "sec", { title: "Стол" }), row("srv-basics", "ch", { title: "Основы стола" }), row("srv-types", "ch", { hidden: true }),
      row("rs-a", "sec", { title: "Стандарты" }), row("rc-1", "ch", { parent: "rs-a", title: "Встреча гостя", body: "т" }), row("coffee", "sec", { hidden: true })]);
    expect(idx.find((e) => e.id === "srv-basics")).toEqual({ id: "srv-basics", title: "Основы стола", course: "Стол", cid: "serving", type: "lesson" });
    expect(idx.find((e) => e.id === "srv-types")).toBeUndefined();
    expect(idx.some((e) => e.cid === "coffee")).toBe(false);
    expect(idx[idx.length - 1]).toEqual({ id: "rc-1", title: "Встреча гостя", course: "Стандарты", cid: "rs-a", type: "lesson", own: true });
    expect(idx.filter((e) => e.leaderOnly).map((e) => e.id)).toEqual(REFERENCE_DAILY_INDEX.filter((e) => e.leaderOnly).map((e) => e.id));
  });
});

describe("v167 · 2: кто читает справочник с правками", () => {
  beforeEach(() => { fresh(); });
  it("«глава дня»: скрытую главу не предложит, свою — может; всё скрыто — задания нет", async () => {
    await loadRefBook();
    const pool = REFERENCE_DAILY_INDEX.filter((l) => !l.leaderOnly);
    const seen = (n) => new Set(Array.from({ length: n }, (_, i) => referenceDailyTask(i).id));
    expect(referenceDailyTask(0)).toEqual({ ...pool[0] });   // правок нет — как раньше
    expect(seen(pool.length).size).toBe(pool.length);
    await saveRefBook([row(pool[0].id, "ch", { hidden: true }), row(pool[1].id, "ch", { title: "Своё название" })], []);
    expect(seen(pool.length).has(pool[0].id)).toBe(false);
    expect(referenceDailyTask(0)).toMatchObject({ id: pool[1].id, title: "Своё название" });
    await saveRefBook([...["serving", "wine", "coffee", "bar"].map((id) => row(id, "sec", { hidden: true })), row("rs-a", "sec", { title: "Стандарты" }), row("rc-1", "ch", { parent: "rs-a", title: "Встреча гостя", body: "т" })], []);
    const left = [...seen(60)];
    expect(left).toContain("rc-1");
    expect(left.filter((id) => id !== "rc-1").every((id) => id.startsWith("app-"))).toBe(true);   // остались только главы «Гида» и своя
    expect(referenceDailyTask(left.indexOf("rc-1"))).toMatchObject({ id: "rc-1", title: "Встреча гостя", course: "Стандарты" });
    expect(rd("ui/reference-daily.js")).toContain("if (!ls.length) return null;");
    expect(rd("ui/screens-gamification.jsx")).toContain("{onReferenceLesson && refTask && (");
  });
  it("поиск, Наставник и чат берут справочник с правками (lib/ref-book.js)", () => {
    const s = rd("ui/search.jsx");
    expect(s).toContain("const refCourses = React.useMemo(() => mergeRefBook(REF_COURSES, refBook.items), [refBook.items]);");
    expect(s).toContain('.replace(/\\[(?:img|photo):[^\\]]*\\]/g, "")');
    const m = rd("lib/reference-context.js");
    expect(m).toContain("const refCourses = () => mergeRefBook(BASE_COURSES, refItemsNow());");
    expect(m).toContain("const paras = refPlain(content).split(/\\n\\n+/).filter(p => p.trim());");
    expect(rd("lib/chat-app.js")).toContain("refs: mergeRefIndex(REFERENCE_DAILY_INDEX, refItemsNow())");
    expect(rd("App.jsx")).toContain("useEffect(() => { if (profId) { loadStaffPhotos(); loadRefBook(); } }, [profId]);");
  });
  it("Наставник: в выдержке главы нет строк с картинками и фото", async () => {
    const { refAssistantContext } = await import("../lib/reference-context.js");
    await loadRefBook();
    await saveRefBook([row("rs-a", "sec", { title: "Стандарты" }), row("rc-1", "ch", { parent: "rs-a", title: "Декантация по нашему", body: "[photo:rp:x1|Зал]\n\n[img:preset_table]\n\nДекантация по нашему стандарту: графин справа от гостя." })], []);
    const ctx = String(refAssistantContext("декантация по нашему стандарту", {}) || "");
    expect(ctx).toContain("Декантация по нашему стандарту: графин справа от гостя.");
    expect(ctx).not.toContain("[photo:");
    expect(ctx).not.toContain("[img:");
    await saveRefBook([row("rc-1", "ch", { parent: "rs-a", title: "Декантация по нашему", body: "Декантация по нашему стандарту: графин справа от гостя.", hidden: true })], []);
    expect(String(refAssistantContext("декантация по нашему стандарту", {}) || "")).not.toContain("графин справа от гостя");
  });
});

describe("v167 · 3: дерево для редактора и строки правок (lib/ref-edit.js)", () => {
  const items = [row("rs-a", "sec", { title: "Стандарты", sub: "Наши правила" }), row("rc-1", "ch", { parent: "rs-a", title: "Встреча гостя", body: "Текст\n[photo:rp:x1|Зал]" }),
    row("srv-types", "ch", { parent: "rs-a" }), row("win-temp", "ch", { title: "Температура", hidden: true, sort: 5 }), row("coffee", "sec", { hidden: true }), row("rs-empty", "sec", { title: "Пустой" })];
  it("в дереве всё, кроме «Гида»: скрытое, пустое, своё; у каждого — что нужно для правки", () => {
    const t0 = refEditTree(RE_BASE, []);
    expect(t0.map((s) => [s.id, s.lessons.length, s.nat, s.own, s.it])).toEqual([["serving", 6, 10, false, null], ["wine", 8, 20, false, null], ["coffee", 7, 30, false, null], ["bar", 6, 40, false, null]]);
    expect(refEditTree(BASE, []).some((s) => s.id === "app")).toBe(false);
    expect(RE_BASE.map((c) => c.id)).toEqual(["serving", "wine", "coffee", "bar"]);
    const t = refEditTree(RE_BASE, items);
    expect(t.map((s) => s.id)).toEqual(["serving", "wine", "coffee", "bar", "rs-a", "rs-empty"]);
    const own = t[4];
    expect(own).toMatchObject({ title: "Стандарты", subtitle: "Наши правила", own: true, hidden: false, edited: false, nat: null });
    expect(own.lessons.map((l) => [l.id, l.own, l.moved, l.home, l.sec])).toEqual([["srv-types", false, true, "serving", "rs-a"], ["rc-1", true, false, "rs-a", "rs-a"]]);
    const wt = t[1].lessons[0];
    expect(wt).toMatchObject({ id: "win-temp", title: "Температура", baseTitle: REFERENCE_WINE_COURSE.lessons[1].title, hidden: true, edited: true, moved: false, nat: 20 });
    expect(wt.content).toBe(wt.baseContent);
    expect(t[2]).toMatchObject({ id: "coffee", hidden: true, edited: false });
    expect(t[5].lessons).toEqual([]);
  });
  it("то, что видит владелец в редакторе, и то, что получит команда, раскладывается одним кодом", () => {
    const t = refEditTree(RE_BASE, items), seen = mergeRefBook(BASE, items);
    for (const c of seen.filter((x) => x.id !== "app")) {
      const s = t.find((x) => x.id === c.id);
      expect(s.lessons.filter((l) => !l.hidden).map((l) => [l.id, l.title, l.content])).toEqual(c.lessons.map((l) => [l.id, l.title, l.content]));
      expect([s.title, s.subtitle]).toEqual([c.title, c.subtitle]);
    }
    expect(seen.map((c) => c.id)).toEqual(["serving", "wine", "bar", "app", "rs-a"]);
  });
  it("порядок: строка пишется только тому, чьё место меняется; новая расстановка действует", () => {
    const sec = refEditTree(RE_BASE, [])[0];
    expect(reorderPut(sec.lessons, ids(sec), "ch")).toEqual([]);
    const want = ["srv-types", "srv-basics", "srv-plates", "srv-cutlery", "srv-glasses", "srv-schools"];
    const put = reorderPut(sec.lessons, want, "ch");
    expect(put).toEqual([row("srv-types", "ch", { sort: 10 }), row("srv-basics", "ch", { sort: 20 })]);
    expect(ids(mergeRefBook(BASE, put)[0])).toEqual(want);
    const t = refEditTree(RE_BASE, items);
    const secs = t.filter((s) => s.id !== "bar"), order = ["rs-a", "serving", "wine", "coffee", "rs-empty"];
    const put2 = reorderPut(secs, order, "sec");
    expect(put2.map((r) => [r.id, r.kind, r.sort, r.title, r.hidden])).toEqual([["rs-a", "sec", 10, "Стандарты", false], ["serving", "sec", 20, null, false], ["wine", "sec", 30, null, false], ["coffee", "sec", 40, null, true], ["rs-empty", "sec", 50, "Пустой", false]]);
    expect(refEditTree(RE_BASE, applyRefEdit(items, put2, [])).filter((s) => s.id !== "bar").map((s) => s.id)).toEqual(order);
    // правка главы при перестановке не теряется: строка пишется целиком
    const moved = reorderPut(t[4].lessons, ["rc-1", "srv-types"], "ch");
    expect(moved).toEqual([row("rc-1", "ch", { parent: "rs-a", title: "Встреча гостя", body: "Текст\n[photo:rp:x1|Зал]", sort: 10 })]);   // у перенесённой место 20 и так
    expect(refEditTree(RE_BASE, applyRefEdit(items, moved, []))[4].lessons.map((l) => l.id)).toEqual(["rc-1", "srv-types"]);
    const back = reorderPut(refEditTree(RE_BASE, applyRefEdit(items, moved, []))[4].lessons, ["srv-types", "rc-1"], "ch");
    expect(back).toEqual([row("srv-types", "ch", { parent: "rs-a", sort: 10 }), row("rc-1", "ch", { parent: "rs-a", title: "Встреча гостя", body: "Текст\n[photo:rp:x1|Зал]", sort: 20 })]);
  });
  it("строка главы: у штатной пишется только то, что отличается; вернул всё как было — строка пуста и её убирают", () => {
    const sec = refEditTree(RE_BASE, [])[0], n = sec.lessons[0];
    const same = chapterRow(n, { title: n.baseTitle, body: n.baseContent + "\r\n", parent: "serving" });
    expect(same).toEqual(row("srv-basics", "ch"));
    expect(refRowEmpty(same)).toBe(true);
    const ed = chapterRow(n, { title: "  Основы  ", body: "Новый текст\r\nвторая строка", parent: "serving" });
    expect(ed).toEqual(row("srv-basics", "ch", { title: "Основы", body: "Новый текст\nвторая строка" }));
    expect(refRowEmpty(ed)).toBe(false);
    expect(chapterRow(n, { title: n.baseTitle, body: n.baseContent, parent: "wine" })).toEqual(row("srv-basics", "ch", { parent: "wine" }));
    const hid = refEditTree(RE_BASE, [row("srv-basics", "ch", { hidden: true, sort: 30 })])[0].lessons.find((l) => l.id === "srv-basics");
    expect(chapterRow(hid, { title: hid.title, body: hid.content, parent: "serving" })).toEqual(row("srv-basics", "ch", { hidden: true, sort: 30 }));   // скрытость и место остаются
    const own = chapterRow({ id: "rc-9", own: true, sec: "rs-a", home: "rs-a", it: null }, { title: " Своя ", body: "Текст", parent: "rs-a" });
    expect(own).toEqual(row("rc-9", "ch", { parent: "rs-a", title: "Своя", body: "Текст" }));
    expect(refRowEmpty(own)).toBe(false);
    expect(refRowEmpty(row("rs-a", "sec"))).toBe(false);
    expect(refRow(refEditTree(RE_BASE, items)[4], "sec")).toEqual(row("rs-a", "sec", { title: "Стандарты", sub: "Наши правила" }));
    expect([sameText("а\r\nб ", " а\nб"), sameText("а", "б"), sameText(null, "")]).toEqual([true, false, true]);
  });
});

describe("v167 · 3: кнопки оформления и свои фото в тексте (lib/ref-edit.js, lib/ref-book.js)", () => {
  it("разметка та же, что у штатных глав; повторное нажатие снимает оформление", () => {
    expect(refFmt("слово тут", 0, 5, "bold")).toEqual({ text: "**слово** тут", s: 2, e: 7 });
    expect(refFmt("", 0, 0, "bold").text).toBe("**текст**");
    const two = "первая\nвторая\nтретья";
    expect(refFmt(two, 2, 10, "list").text).toBe("• первая\n• вторая\nтретья");
    expect(refFmt("• первая\n• вторая\nтретья", 0, 12, "list").text).toBe("первая\nвторая\nтретья");
    expect(refFmt(two, 0, 20, "num").text).toBe("1. первая\n2. вторая\n3. третья");
    expect(refFmt("1. первая\n2. вторая", 0, 19, "num").text).toBe("первая\nвторая");
    expect(refFmt(two, 8, 8, "head").text).toBe("первая\n**вторая**\nтретья");
    expect(refFmt("первая\n**вторая**\nтретья", 9, 9, "head").text).toBe(two);
    expect(refFmt("• пункт", 3, 3, "head").text).toBe("**пункт**");
    expect(refFmt(two, 0, 0, "note").text).toBe(REF_MARKS.note + " первая\nвторая\nтретья");
    expect(refFmt(two, 0, 0, "good").text.startsWith(REF_MARKS.good + " первая")).toBe(true);
    expect(refFmt(REF_MARKS.good + " первая", 0, 0, "bad").text).toBe(REF_MARKS.bad + " первая");   // метка меняется, а не копится
    expect(refFmt(REF_MARKS.bad + " первая", 0, 0, "bad").text).toBe("первая");
    expect(refFmt("1. первая", 0, 0, "list").text).toBe("• первая");
  });
  it("выделили до начала следующей строки — её не трогаем; пустые строки между пунктами остаются пустыми", () => {
    expect(refFmt("первая\nвторая", 0, 7, "list").text).toBe("• первая\nвторая");
    expect(refFmt("первая\n\nвторая", 0, 14, "list").text).toBe("• первая\n\n• вторая");
    const r = refFmt("строка", 3, 3, "list");
    expect([r.text, r.s, r.e]).toEqual(["• строка", 8, 8]);   // без выделения курсор встаёт в конец строки
    const e = refFmt("", 0, 0, "list");
    expect([e.text, e.s]).toEqual(["• ", 2]);
    expect(refFmt("", 0, 0, "head").text).toBe("**Заголовок**");
  });
  it("метки строк рисует тот же код, что у штатных глав", () => {
    const html = R(h(RefContent, { text: "**Заголовок**\n• пункт\n1. первый\n" + REF_MARKS.note + " важно\n" + REF_MARKS.good + " верно\n" + REF_MARKS.bad + " неверно\nобычный **жирный** текст", T: S, gold: "#C8A96E", dark: true }));
    for (const w of ["Заголовок", "пункт", "первый", "важно", "верно", "неверно", "жирный"]) expect(text(html)).toContain(w);
    expect(text(html)).not.toContain("**");
    for (const m of Object.values(REF_MARKS)) expect(html).not.toContain(m);   // метка в тексте становится значком
    expect(count(html, "<svg")).toBe(3);
    expect(html).toContain("<b ");
  });
  it("вставка строки туда, где курсор: всегда отдельной строкой", () => {
    expect(refInsertLine("раз\nдва", 3, "[img:x]")).toEqual({ text: "раз\n[img:x]\nдва", pos: 12 });
    expect(refInsertLine("раздва", 3, "[img:x]").text).toBe("раз\n[img:x]\nдва");
    expect(refInsertLine("", 0, "[img:x]")).toEqual({ text: "[img:x]\n", pos: 8 });
    expect(refInsertLine("текст", null, "[img:x]").text).toBe("текст\n[img:x]\n");
    expect(refInsertLine("раз\n", 4, "[img:x]").text).toBe("раз\n[img:x]\n");
  });
  it("строка своего фото: [photo:номер|подпись]; номера из текста — по порядку и без повторов", () => {
    expect(refPhotoLine("rp:a1", "  Зал\nутром ")).toBe("[photo:rp:a1|Зал утром]");
    expect(refPhotoLine("rp:a1", "")).toBe("[photo:rp:a1]");
    expect("[photo:rp:a1|Зал [у окна]]".match(REF_PHOTO_RE).slice(1)).toEqual(["rp:a1", "Зал [у окна]"]);
    expect("[photo:rp:a1]".match(REF_PHOTO_RE)[2]).toBeUndefined();
    expect("текст [photo:rp:a1] в строке".match(REF_PHOTO_RE)).toBeNull();
    expect(refPhotoIds("а\n[photo:rp:x1|Зал]\n  [photo:rp:x2]  \n[photo:rp:x1]\n[img:preset_table]")).toEqual(["rp:x1", "rp:x2"]);
    expect(refPhotoIds(null)).toEqual([]);
    expect(refPlain("а\n[img:k]\n [photo:rp:x1|Зал]\nб [photo:rp:x] в строке")).toBe("а\n\n\nб [photo:rp:x] в строке");
  });
});

// ── экраны ──────────────────────────────────────────────────────────────────────────────────────────────────
const PH = { full: "QUJD".repeat(40), thumb: "REVG".repeat(8), w: 900, h: 600, by: "Роман" };
const OWN = [row("rs-a", "sec", { title: "Стандарты заведения", sub: "Наши правила" }), row("rc-1", "ch", { parent: "rs-a", title: "Встреча гостя", body: "**Первые секунды**\nУлыбка и взгляд.\n[photo:rp:x1|Вход в зал]\n[photo:rp:gone]" }),
  row("rc-2", "ch", { parent: "rs-a", title: "Скрытая глава", body: "т", hidden: true }), row("srv-types", "ch", { title: "Виды сервировки, наши", hidden: false }), row("coffee", "sec", { hidden: true })];
const book = async (items, more = {}, tok = "tr") => { fresh({ refBook: items, lessonPhotos: { "rp:x1|": PH, "ref:rs-a|": PH }, ...more }, tok); await loadRefBook(); await loadLessonPhotos(); };
const refScreen = (p = {}) => R(h(ReferenceSection, { T: S, a11y: false, onExit: noop, profile: ANNA, ...p }));

describe("v167 · 4: справочник с правками на экране (ui/ReferenceSection.jsx)", () => {
  it("карточки хаба — из разделов: штатные с прежними подписями, свои — за ними, «Гид» карточкой не стал (v172: «Бар: Основы» — карточка)", () => {
    expect(REF_OFF_HUB).toEqual(["app"]);
    expect(hubCards(BASE).map((c) => [c.id, c.t, c.s])).toEqual([["serving", "Сервировка", "6 глав с фото"], ["wine", "Вина", "8 глав"], ["coffee", "Кофе", "7 глав со схемами"], ["bar", "Бар: Основы", "6 глав"]]);
    const cards = hubCards(mergeRefBook(BASE, OWN));
    expect(cards.map((c) => [c.id, c.t, c.s])).toEqual([["serving", "Сервировка", "6 глав с фото"], ["wine", "Вина", "8 глав"], ["bar", "Бар: Основы", "6 глав"], ["rs-a", "Стандарты заведения", "1 глава"]]);
    expect(hubCards(null)).toEqual([]);
    // у своего раздела — рисунок-книга в том же ряду витражей (значок в линзе среди них смотрелся чужим: Доп. 433);
    // у «Бар: Основы» — витраж с бокалом
    expect(cards.map((c) => c.art)).toEqual([undefined, undefined, "cocktails", "book"]);
    expect(rd("ui/reference-art.jsx")).toContain("const ART = { serving: Serving, wine: Wine, coffee: Coffee, cocktails: Cocktails, winelist: WineList, book: Book };");
    expect(rd("ui/ReferenceSection.jsx")).toContain('hasArt = ["serving", "wine", "coffee", "cocktails", "winelist", "book"].includes(art);');
  });
  it("плитка главы без своего фото — первое фото из её текста", () => {
    const src = rd("ui/ReferenceSection.jsx");
    expect(src).toContain("for (const pid of refPhotoIds(lesson.content)) { const p = photoOf(photos, pid); if (p) return { id: pid, info: p }; }");
    expect(src).toContain("const chapterHasPic = (lesson, photos) => !!tilePhoto(lesson, photos) || !!chapterThumb(lesson, hasIllMini);");
  });
  it("без правок хаб: три курса и «Бар: Основы» (до v172 — барная карта); сотруднику кнопки «Редактор» нет", async () => {
    await book([]);
    const html = refScreen();
    expect([...html.matchAll(/data-ref-card="([^"]+)"/g)].map((m) => m[1])).toEqual(["serving", "wine", "coffee", "bar"]);
    expect(html).not.toContain("data-ref-edit");
    expect(text(html)).toContain("6 глав с фото");
  });
  it("с правками: свой раздел карточкой с обложкой, скрытого раздела нет; владельцу — «Редактор»", async () => {
    await book(OWN);
    const html = refScreen();
    expect([...html.matchAll(/data-ref-card="([^"]+)"/g)].map((m) => m[1])).toEqual(["serving", "wine", "bar", "rs-a"]);   // v172: «Бар: Основы» — после штатных, перед своими
    expect(text(html)).toContain("Стандарты заведения");
    expect(text(html)).toContain("1 глава");
    expect(html).toMatch(/data-ref-card="rs-a" data-ref-cover="(own|wait)"/);
    expect(html).not.toContain("data-ref-edit");
    const own = refScreen({ profile: ROMAN, onEdit: noop });
    expect(count(own, 'data-ref-edit=""')).toBe(1);
    expect(text(own)).toContain("Редактор");
  });
  it("своя глава: текст, своё фото с подписью; фото, которого нет, сотруднику не видно; владельцу — «Править главу»", async () => {
    await book(OWN);
    const html = refScreen({ startLessonId: "rc-1" });
    expect(text(html)).toContain("Встреча гостя");
    expect(text(html)).toContain("Первые секунды");
    expect(text(html)).toContain("Улыбка и взгляд.");
    expect(count(html, "data-ref-own-photo=")).toBe(1);
    expect(html).toContain('data-ref-own-photo="rp:x1"');
    expect(text(html)).toContain("Вход в зал");
    expect(text(html)).not.toContain("[photo:");
    expect(html).not.toContain("data-ref-photo-gone");
    expect(html).not.toContain("data-ref-edit-ch");
    const own = refScreen({ startLessonId: "rc-1", profile: ROMAN, onEdit: noop });
    expect(own).toContain('data-ref-edit-ch="rc-1"');
    expect(text(own)).toContain("Править главу");
    // в предпросмотре редактора пропавшее фото помечено, чтобы строку было видно
    const pv = R(h(RefContent, { text: "[photo:rp:gone|Подпись]", T: S, gold: "#C8A96E", dark: true, notes: true }));
    expect(pv).toContain("data-ref-photo-gone");
    expect(text(pv)).toContain("Фото не найдено");
  });
  it("штатная глава с правкой — под своим названием; скрытая глава и глава скрытого раздела не открываются (хаб)", async () => {
    await book(OWN);
    expect(text(refScreen({ startLessonId: "srv-types" }))).toContain("Виды сервировки, наши");
    for (const id of ["rc-2", "cof-bean", "нет-такой"]) {
      const html = refScreen({ startLessonId: id });
      expect(html, id).toContain("data-ref-card=");
      expect(text(html), id).toContain("Справочник");
    }
  });
  it("«Гид по приложению»: владельцу кнопки «Править главу» нет (он не правится)", async () => {
    await book(OWN);
    const html = refScreen({ startLessonId: "app-start", profile: ROMAN, onEdit: noop });
    expect(text(html)).toContain(REFERENCE_APP_COURSE.lessons[0].title);
    expect(html).not.toContain("data-ref-edit-ch");
  });
  it("глава помнится по номеру, а не по месту: правки владельца не сбивают читающего", () => {
    const src = rd("ui/ReferenceSection.jsx");
    expect(src).toContain("const [lid, setLid] = R.useState(startCourseId ? startLessonId : null);");
    expect(src).toContain("const idx = lid ? lessons.findIndex(l => l.id === lid) : -1;");
    expect(src).toContain('const shown = view === "read" && !lesson ? (course ? "course" : "hub") : view === "course" && !course ? "hub" : view;');
    expect(src).not.toContain("setIdx(");
    expect(src).toContain("const [entry, setEntry] = R.useState(startCourseId && !startInside ? startLessonId : null);");
  });
  it("без этапа 53 справочник штатный, как раньше", async () => {
    await book(OWN, { noStage53: true });
    expect(refBookNow().missing).toBe(true);
    const html = refScreen();
    expect([...html.matchAll(/data-ref-card="([^"]+)"/g)].map((m) => m[1])).toEqual(["serving", "wine", "coffee", "bar"]);
  });
  it("обложки своих разделов готовятся заранее, как у штатных", () => {
    const map = { "ref:rs-a": { best: { ver: "v1" } }, "ref:coffee": { best: { ver: "v2" } }, "mod:m1": { best: { ver: "v3" } }, "rp:x1": { best: { ver: "v4" } } };
    const plan = aheadPlan({ map }, {});
    expect(plan.full).toEqual(["ref:coffee", "ref:rs-a"]);
    expect(plan.thumbs).toEqual(["ref:coffee", "ref:rs-a", "mod:m1", "rp:x1"]);
  });
});

const edScreen = (p = {}) => noDoc(() => R(h(RefEditorScreen, { T: S, a11y: false, profile: ROMAN, onBack: noop, ...p })));

describe("v167 · 5: экран редактора (ui/ref-editor.jsx)", () => {
  it("разделы: штатные и свои, пометки, «Новый раздел», про «Гид» — строка (v172: «Бар: Основы» — в общем списке, блока «Отдельно» нет)", async () => {
    await book(OWN);
    const html = edScreen();
    expect(html).toContain('data-re-screen="list"');
    expect([...html.matchAll(/data-re-sec="([^"]+)"/g)].map((m) => m[1])).toEqual(["serving", "wine", "coffee", "bar", "rs-a"]);
    const t = text(html);
    for (const w of ["Редактор справочника", "Стандарты заведения", "свой раздел", "скрыт", "1 глава скрыта", "Новый раздел", "Бар: Основы", "«Гид по приложению» обновляется вместе с приложением"]) expect(t, w).toContain(w);
    for (const w of ["Отдельно", "Бар: истории и техника", "из колоды бармена"]) expect(t, w).not.toContain(w);
    expect(t).toContain("5 разделов");
    expect(count(html, 'data-re-up=""')).toBe(5);   // порядок — у всех разделов, и у «Бар: Основы»
    expect(html).not.toContain("data-re-missing");
    expect(t).not.toMatch(/[а-яё] — [а-яё]/i);
  });
  it("нет этапа 53: владельцу — что запустить и «Проверить ещё раз», списка нет", async () => {
    await book([], { noStage53: true });
    const html = edScreen();
    expect(html).toContain("data-re-missing");
    expect(text(html)).toContain("supabase-stage53-ref-book.sql");
    expect(text(html)).toContain("Проверить ещё раз");
    expect(html).not.toContain("data-re-sec=");
    expect(html).not.toContain("data-re-new-sec");
  });
  it("вошли с главы: сразу она, с названием и текстом; кнопки оформления, «Как увидит сотрудник», «Записать главу»", async () => {
    await book(OWN);
    const html = edScreen({ startId: "rc-1" });
    expect(html).toContain('data-re-screen="ch"');
    expect(html).toMatch(/data-re-ch-title=""[^>]*value="Встреча гостя"/);
    expect(html).toContain("Улыбка и взгляд.");
    expect([...html.matchAll(/data-re-tool="([^"]+)"/g)].map((m) => m[1])).toEqual(["bold", "head", "list", "num", "note", "good", "bad", "photo", "scheme"]);
    const t = text(html);
    for (const w of ["Заголовок", "• Список", "1. Список", "Важно", "Верно", "Неверно", "Фото", "Схема", "Как увидит сотрудник", "Раздел главы", "Записать главу", "Отменить", "Удалить главу", "Скрыть главу", "Фото главы", "Черновик сохраняется на телефоне сам"]) expect(t, w).toContain(w);
    expect([...html.matchAll(/data-re-parent="([^"]+)"/g)].map((m) => m[1])).toEqual(["serving", "wine", "coffee", "bar", "rs-a"]);
    expect(html).toMatch(/data-re-parent="rs-a" aria-pressed="true"/);
    expect(html).not.toContain("data-re-ch-reset");   // своя глава: «вернуть как было» ей ни к чему
  });
  it("штатная глава: «Вернуть как было» только когда она правилась; удалить её нельзя", async () => {
    await book(OWN);
    const ed = edScreen({ startId: "srv-types" });
    expect(ed).toMatch(/data-re-ch-title=""[^>]*value="Виды сервировки, наши"/);
    expect(ed).toContain("data-re-ch-reset");
    expect(ed).not.toContain("data-re-ch-del");
    const plain = edScreen({ startId: "srv-basics" });
    expect(plain).toMatch(new RegExp('data-re-ch-title=""[^>]*value="' + REFERENCE_COURSE.lessons[0].title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"'));
    expect(plain).not.toContain("data-re-ch-reset");
    expect(plain).not.toContain("data-re-ch-del");
    expect(edScreen({ startId: "нет-такой" })).toContain('data-re-screen="list"');
    expect(edScreen({ startId: "app-start" })).toContain('data-re-screen="list"');   // «Гид» не правится
  });
  it("черновик главы: что набрано и не записано, возвращается; то же, что на сервере, черновиком не считается", async () => {
    await book(OWN);
    const node = refEditTree(RE_BASE, refItemsNow()).find((s) => s.id === "rs-a").lessons.find((l) => l.id === "rc-1");
    expect(chapterDraft(node, null)).toEqual({ draft: { id: "rc-1", isNew: false, title: "Встреча гостя", body: node.content, parent: "rs-a" }, restored: null });
    expect(chapterDraft(node, { forId: "rc-1", at: 5, title: "Встреча гостя", body: node.content + "\n", parent: "rs-a" }).restored).toBeNull();
    expect(chapterDraft(node, { forId: "rc-2", at: 5, title: "Другая", body: "т" }).restored).toBeNull();
    const d = chapterDraft(node, { forId: "rc-1", at: 1731700000000, title: "Встреча гостя", body: "Дописал", parent: "rs-a" });
    expect(d).toEqual({ draft: { id: "rc-1", isNew: false, title: "Встреча гостя", body: "Дописал", parent: "rs-a" }, restored: 1731700000000 });
    phone.setItem(RE_DRAFT, JSON.stringify({ forId: "rc-1", at: 1731700000000, title: "Встреча гостя", body: "Дописал", parent: "rs-a" }));
    const html = edScreen({ startId: "rc-1" });
    expect(html).toContain("data-re-draft");
    expect(text(html)).toContain("Восстановлен черновик от ");
    expect(text(html)).toContain("Начать заново");
    expect(html).toContain("Дописал");
  });
  it("у каждой схемы и каждого фото из приложения есть название", () => {
    const { art, photo } = illKeys();
    expect(art.length).toBe(22);
    expect(photo.length).toBe(21);
    for (const k of Object.keys(ILL)) expect(typeof ILL_NAMES[k], k).toBe("string");
    for (const k of Object.keys(ILL_NAMES)) expect(ILL[k], k).toBeTruthy();
    expect(new Set(Object.values(ILL_NAMES)).size).toBe(Object.keys(ILL_NAMES).length);
  });
  it("«назад»: у шапки подпись «Вернуться» (правило v71), у листов кнопка закрытия помечена — «Назад» Telegram закрывает лист", () => {
    const src = rd("ui/ref-editor.jsx");
    expect(src).toContain('<button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={back}>‹</button>');
    expect(src).not.toContain('aria-label="Назад"');
    expect(src).toContain('<button type="button" aria-label="Закрыть" data-lens="disc" data-lens-x="" data-sa-back="" onClick={onClose}');
    expect(rd("lib/utils.js")).toContain(`const marked = [...layer.querySelectorAll('[data-sa-back], [aria-label="Назад"]')].find(visible);`);
  });
  it("редактор открыли — правки берутся с сервера заново; ничего не меняли — сервер не трогаем", () => {
    const src = rd("ui/ref-editor.jsx");
    expect(src).toContain("React.useEffect(() => { loadRefBook(true); }, []);");
    expect(src).toContain("if (!draft.isNew && !dirty) { dropDraft(); goBack(); return; }");
    expect(src).toContain("if (!put.length && !del.length) { dropDraft(); goBack(); return; }");
    expect(src).toContain("if (refRowEmpty(row) && !sec.it) { setMeta(null); return; }");
  });
  it("о редакторе сказано в «Гиде» и в главе «Инструменты руководителя» (её читает Наставник)", () => {
    const leader = REFERENCE_APP_COURSE.lessons.find((l) => l.id === "app-leader");
    expect(leader.leaderOnly).toBe(true);
    expect(leader.content).toContain("• **Редактор справочника**: владелец добавляет в «Справочник» свои разделы и главы и правит штатные («Справочник» → «Редактор»).");
  });
  it("светлая тема рисуется; мелкого шрифта, тире между словами и «только для руководителя» в файле нет", async () => {
    await book(OWN);
    const html = noDoc(() => R(h(RefEditorScreen, { T: A, a11y: true, profile: ROMAN, onBack: noop, startId: "rc-1" })));
    expect(html).toContain('data-re-screen="ch"');
    const src = code(rd("ui/ref-editor.jsx"));
    for (const m of src.matchAll(/fontSize: (\d+(?:\.\d+)?)/g)) expect(Number(m[1]), m[0]).toBeGreaterThanOrEqual(11.5);
    expect(src).not.toMatch(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/);
    expect(src).not.toMatch(/textTransform: "uppercase"/);
    expect(src).not.toContain("·");
  });
});

describe("v167 · 5: редактор в приложении (App.jsx)", () => {
  const app = rd("App.jsx");
  it("экран грузится по требованию и только владельцу; вход — из справочника и из «Управления»", () => {
    expect(app).toContain('const RefEditorScreen = lazy(() => retryImport(() => import("./ui/ref-editor")).then(m => ({ default: m.RefEditorScreen })));');
    expect(app).toContain('{screen === "refEditor" && profile?.is_admin && <Suspense fallback={<ScreenLoader T={T} />}><RefEditorScreen T={T} a11y={a11y} profile={profile} startId={refEdit} onBack={() => goBack("reference")} /></Suspense>}');
    expect(app).toContain('profile?.is_admin && { key:"re", group:"Управление", icon:"book", label:"Редактор справочника", sub:"Разделы, главы, текст и фото", onClick:() => { setRefEdit(null); navigate("refEditor"); } },');
    expect(app).toContain('startInside={refInside} onEdit={profile?.is_admin ? (id) => { setRefEdit(id || null); if (id) { setRefStart(id); setRefInside(true); } navigate("refEditor"); } : null} /></Suspense>}');
    expect(app).toContain('if (screen !== "refEditor") setRefEdit(null); if (screen !== "reference" && screen !== "refEditor") setRefInside(false);');
    expect(rd("ui/guide.jsx")).toContain('{ key: "refeditor", title: "Редактор справочника", text: "«Справочник» → «Редактор»');
    expect(rd("ui/guide.jsx")).toMatch(/key: "refeditor"[^\n]*go: "refEditor", admin: true \}/);
    expect(rd("ui/home-hubs.jsx")).toMatch(/\n  book: \(c\) => <svg/);
  });
  it("в стартовую сборку справочник не попал: лёгкий слой правок не тянет ни текст глав, ни экраны, ни сам редактор", () => {
    const lib = rd("lib/ref-book.js");
    expect([...lib.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1])).toEqual(["../api/supabase"]);
    expect([...rd("lib/ref-edit.js").matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1])).toEqual(["../api/supabase", "./ref-book"]);
    // то, что нужно только редактору (запись, дерево, кнопки оформления), лежит отдельно и грузится вместе с ним
    for (const name of ["saveRefBook", "refEditTree", "refFmt", "reorderPut", "chapterRow", "refBookErr"]) expect(lib, name).not.toContain("export function " + name);
    for (const f of ["App.jsx", "ui/reference-daily.js", "lib/chat-app.js", "lib/reference-context.js", "ui/search.jsx", "ui/ReferenceSection.jsx", "ui/use-ref-book.js"]) expect(rd(f), f).not.toMatch(/ref-edit["']/);
    expect(rd("ui/ref-editor.jsx")).toContain('from "../lib/ref-edit";');
    expect(rd("ui/use-ref-book.js")).not.toContain("data/reference");
    expect(app).not.toMatch(/import \{[^}]*\} from "\.\/ui\/ref-editor"/);
    expect(app).toContain('import { loadRefBook } from "./lib/ref-book";');
  });
});
