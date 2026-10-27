// v91 (Доп. 404): чат смены после первого запуска в зале — «Написать» снова видит коллег (функции с токеном VOLATILE),
// низ экрана не прячется под вырезом в полноэкранном Telegram, клавиатура не вычитается дважды; круг чата рядом с нижним
// меню вместо значка в верхней строке; «Очистить чат»; удалённое исчезает целиком. Сервер — этап 38
// (tools/claude/sql/test38.sh), вид — tools/claude/e2e-v91.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const DASH = /[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g;

// все функции всех этапов: имя, вид (volatile / stable / immutable), тело
function sqlFunctions() {
  const out = [];
  for (const f of readdirSync("supabase").filter((x) => x.endsWith(".sql"))) {
    const s = rd("supabase/" + f);
    const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\(/gi;
    let m;
    while ((m = re.exec(s))) {
      const rest = s.slice(m.index);
      const tm = rest.match(/\$([a-z_]*)\$/i);
      if (!tm) continue;
      const b0 = tm.index + tm[0].length, b1 = rest.indexOf(tm[0], b0);
      if (b1 < 0) continue;
      const tail = rest.indexOf(";", b1 + tm[0].length);
      const opts = (rest.slice(0, tm.index) + " " + rest.slice(b1 + tm[0].length, tail)).toLowerCase();
      out.push({ file: f, name: m[1].toLowerCase(), body: rest.slice(b0, b1), vol: /\bimmutable\b/.test(opts) ? "immutable" : /\bstable\b/.test(opts) ? "stable" : "volatile" });
    }
  }
  return out;
}

describe("v91: функции с токеном — VOLATILE (PostgREST зовёт STABLE «только для чтения»)", () => {
  const fns = sqlFunctions();
  // кто проверяет вход: whoami и всё, что зовёт его (прямо или через помощников)
  const auth = new Set(["whoami", "whoami_txt"]);
  for (let i = 0; i < 6; i++) for (const x of fns) if (!auth.has(x.name) && [...auth].some((a) => new RegExp("\\b" + a + "\\s*\\(", "i").test(x.body))) auth.add(x.name);
  const helper = (n) => n === "whoami" || n === "whoami_txt" || n.startsWith("_");
  it("во всех этапах функция приложения с проверкой входа объявлена VOLATILE (помощники с «_» — не в счёт: их зовут изнутри)", () => {
    expect(auth.size).toBeGreaterThan(100);
    for (const n of ["chat_people", "chat_unread", "chat_photo", "chat_clear", "my_reset_at", "hr_quality_get", "my_state"]) expect([n, auth.has(n)]).toEqual([n, true]);
    expect(fns.filter((x) => auth.has(x.name) && !helper(x.name) && x.vol !== "volatile").map((x) => x.file + ": " + x.name + " " + x.vol)).toEqual([]);
  });
  it("этап 38: chat_unread, chat_people, chat_photo — volatile (в v90 были stable и молча падали); перезапуск переводит my_reset_at и hr_quality_get", () => {
    const sql = rd("supabase/supabase-stage38-chat.sql");
    for (const f of ["chat_unread(p_token text)", "chat_people(p_token text)", "chat_photo(p_token text, p_id bigint, p_full boolean default false)", "chat_clear(p_token text, p_chat bigint)"])
      expect([f, sql.includes("create or replace function " + f + "\nreturns jsonb language plpgsql volatile security definer")]).toEqual([f, true]);
    expect(sql).toContain("if to_regprocedure('public.my_reset_at(text)') is not null then execute 'alter function public.my_reset_at(text) volatile'; end if;");
    expect(sql).toContain("if to_regprocedure('public.hr_quality_get(text,text)') is not null then execute 'alter function public.hr_quality_get(text, text) volatile'; end if;");
    expect(rd("supabase/supabase-stage20-reset-traces.sql")).toContain("create or replace function my_reset_at(p_token text)\nreturns jsonb language plpgsql volatile");
    expect(rd("supabase/supabase-stage28-ai-hr.sql")).toContain("create or replace function public.hr_quality_get(p_token text, p_restaurant text)\nreturns json language plpgsql volatile");
  });
  it("test38: как PostgREST — whoami с записью, STABLE-функция в «только для чтения» падает, функции чата отвечают", () => {
    const t = rd("tools/claude/sql/test38.sh");
    expect(t).toContain("update sessions set seen_at = now() where token = p_token;");
    expect(t).toContain('[ "$vol" != "v" ] && mode="read only"');
    expect(t).toMatch(/chk "все (?:(?:16|20) функций|31 функция) чата — VOLATILE: PostgREST не запирает их «только для чтения»"/);   // v92: 20 (свои чаты), v93: 31 (умный чат)
  });
});

describe("v91: «Очистить чат» и удалённое без следа (этап 38)", () => {
  const sql = rd("supabase/supabase-stage38-chat.sql");
  const clr = sql.slice(sql.indexOf("create or replace function chat_clear("), sql.indexOf("end; $$;", sql.indexOf("create or replace function chat_clear(")));
  it("chat_clear: группа — кто удаляет чужое, личная — любой из двоих; стирает всё, закреп снимает, метка cleared_at; строки «кто очистил» нет", () => {
    expect(clr).toMatch(/if not \(ch\.kind = 'dm' or \(coalesce\(\(c->>'lead'\)::boolean, false\) and ch\.kind in \('team', 'leads'(, 'group')?\)\)\n {10}or \(coalesce\(\(c->>'network'\)::boolean, false\) and ch\.kind = 'net'\)\) then/);   // v92: и свой чат
    expect(clr).toContain("delete from sa_chat_msgs where chat_id = ch.id;");
    expect(clr).toContain("update sa_chats set pin_id = null, pin_by = c->>'id', pin_at = t, cleared_at = t where id = ch.id;");
    expect(clr).not.toContain("insert into sa_chat_msgs");
    expect(clr).not.toContain("очищает");
    expect(sql).toContain("alter table sa_chats add column if not exists cleared_at timestamptz;");
    expect(sql).toContain("'unread', _sa_chat_unread(ch.id, c->>'id'), 'cleared', ch.cleared_at");   // v92: дальше — название своего чата
    expect(sql).toContain("grant execute on function chat_clear(text, bigint) to anon, authenticated;");
  });
  it("удалённое: в первой странице и раньше его нет (в опросе — с del), в списке — последнее неудалённое, личная из одних удалённых не видна", () => {
    expect(sql).toContain("from (select * from sa_chat_msgs x where x.chat_id = ch.id and not x.deleted order by x.id desc limit 60) m;");
    expect(sql).toContain("from (select * from sa_chat_msgs x where x.chat_id = ch.id and x.id < p_before and not x.deleted order by x.id desc limit 40) m;");
    expect(sql).toContain("select * into lm from sa_chat_msgs m where m.chat_id = ch.id and not m.deleted order by m.id desc limit 1;");
    expect(sql).toContain("and (x.kind <> 'dm' or exists (select 1 from sa_chat_msgs m where m.chat_id = x.id and not m.deleted))");
  });
});

describe("v91: экран чата", () => {
  it("клавиатура: сколько закрыто снизу — по низу самого слоя (в Telegram окно сжимается, а innerHeight прежний)", async () => {
    const { kbOverlap } = await import("../ui/chat.jsx");
    expect(kbOverlap(852, 0, 552)).toBe(300);    // клавиатура поверх окна
    expect(kbOverlap(552, 0, 552)).toBe(0);      // окно само сжалось: второй раз не вычитаем
    expect(kbOverlap(852, 40, 512)).toBe(300);   // видимая часть прокручена
    expect(kbOverlap(500, 0, 552)).toBe(0);
    expect(kbOverlap(undefined, null, NaN)).toBe(0);
    // v94: расчёт переехал в ui/keyboard.js (общий с Наставником), низ — по-прежнему от самого слоя
    expect(rd("ui/keyboard.js")).toContain("try { if (el) return el.getBoundingClientRect(); } catch (e) { /* */ }");
    expect(rd("ui/chat.jsx")).toContain('<div ref={rootRef} className={"sa-dlg ch" + (a11y ? " lt" : "") + (kb.up ? " kb" : "")}');
  });
  it("низ в полноэкранном Telegram: --sa-sb (вырез из Telegram) у строки ввода, списка, листов и фото; при клавиатуре запаса нет", () => {
    const src = rd("ui/chat.jsx");
    for (const s of [".ch-list{max-width:640px;margin:0 auto;padding:6px 0 calc(24px + var(--sa-sb,env(safe-area-inset-bottom,0px)))}",
      ".ch-bar{flex:0 0 auto;position:relative;z-index:3;padding:8px 8px calc(8px + var(--sa-sb,env(safe-area-inset-bottom,0px)));",
      ".sa-dlg.ch.kb .ch-bar{padding-bottom:8px}", "[data-chat-people]{padding-bottom:calc(16px + var(--sa-sb,env(safe-area-inset-bottom,0px)))}",
      ".sa-dlg.ch.kb [data-chat-people]{padding-bottom:16px}", ".ch-view-img:last-child{margin-bottom:var(--sa-sb,env(safe-area-inset-bottom,0px))}"]) expect([s, src.includes(s)]).toEqual([s, true]);
    expect(src).not.toMatch(/padding:[^;}]*calc\([^)]*\+ env\(safe-area-inset-bottom/);   // нигде не голый env()
  });
  it("«Написать»: список не пришёл — «Список коллег не загрузился», пусто — «Пока здесь никого», по поиску — «Никого не нашёл»", () => {
    const src = rd("ui/chat.jsx");
    expect(src).toContain('bad ? <div className="ch-empty" role="alert" data-chat-people-bad="">Список коллег не загрузился. Проверь связь и открой ещё раз.</div>');
    expect(src).toMatch(/\{q\.trim\(\) \? "Никого не нашёл\." : ("Пока здесь никого\."|emptyText)\}/);   // v92: «Пока здесь никого.» — по умолчанию emptyText
    expect(src).toContain('emptyText = "Пока здесь никого."');
  });
  it("очистить: кто может; метка cleared сменилась — переписку перечитать; в ленте удалённого нет", async () => {
    const C = await import("../lib/chat.js");
    const lead = { id: "m", lead: true, network: false }, waiter = { id: "a", lead: false }, net = { id: "n", lead: true, network: true };
    expect([C.canClear({ kind: "team" }, lead), C.canClear({ kind: "team" }, waiter), C.canClear({ kind: "leads" }, lead), C.canClear({ kind: "net" }, lead), C.canClear({ kind: "net" }, net), C.canClear({ kind: "dm" }, waiter), C.canClear(null, lead)])
      .toEqual([true, false, true, false, true, true, false]);
    expect(C.clearedChanged(null, null)).toBe(false);
    expect(C.clearedChanged(null, "2026-10-26T09:41:00.123456+00:00")).toBe(true);
    expect(C.clearedChanged("2026-10-26T09:41:00.123456+00:00", "2026-10-26T21:41:00.123456+12:00")).toBe(false);   // то же мгновение
    const rows = C.feedRows([{ id: 1, emp: "a", at: new Date().toISOString(), body: "раз" }, { id: 2, emp: "a", del: true, body: "", at: new Date().toISOString() }, { id: 3, emp: "a", at: new Date().toISOString(), body: "три" }], "me", true);
    expect(rows.filter((r) => r.type === "msg").map((r) => r.m.id)).toEqual([1, 3]);
    expect(rows.find((r) => r.m && r.m.id === 3).same).toBe(true);   // столбик не рвётся на месте удалённого
  });
  it("лист «Очистить»: переспросить; группа — у всех, пусто; личная — у обоих, уйдёт из списка; кнопка в шапке — тем, кому можно", () => {
    const src = rd("ui/chat.jsx");
    expect(src).toContain('{canClear(chat, me) ? <button type="button" className="ch-tool" data-chat-clear="" aria-label={group ? "Очистить чат" : "Очистить переписку"}');
    expect(src).toContain('"Сообщения и фото исчезнут у вас обоих, а переписка уйдёт из списка чатов. Вернуть их нельзя."');
    expect(src).toContain('"Сообщения, фото и закреплённое исчезнут у всех, чат станет пустым. Вернуть переписку нельзя."');
    expect(src).toContain("else if (clearedChanged(cleared.current, cl)) { cleared.current = cl; wipe(); if (pullRef.current) pullRef.current(true); return; }");
    expect(src).toContain("{loaded && !rows.length && !pending.length ?");
    const sheet = src.slice(src.indexOf("function ClearSheet("), src.indexOf("// ── фото к отправке"));
    expect(sheet.match(DASH)).toBe(null);
  });
  it("открытая переписка не закрывается опросом списка (новая личная без сообщений, очищенная личная)", () => {
    const src = rd("ui/chat.jsx");
    expect(src).toContain("setChats(k && !list.some((c) => String(c.id) === String(k.id)) ? [...list, k] : list);");
    expect(src).toContain("keepRef.current = cur;");
    expect(src).toContain("onBack={() => { keepRef.current = null; setCurId(null); load(); }}");
  });
  it("API: chat_clear", async () => {
    const { chatApi } = await import("../lib/chat-api.js");
    const seen = [];
    const api = chatApi((fn, args) => { seen.push([fn, args]); return Promise.resolve({ ok: true }); });
    await api.clear(7);
    expect(seen).toEqual([["chat_clear", { p_chat: 7 }]]);
  });
});

describe("v91: круг чата рядом с нижним меню (ui/tabbar.jsx)", () => {
  const tabs = [{ id: "roleSelect", icon: "home", label: "Учусь" }, { id: "shift", icon: "daily", label: "Смена" }, { id: "teamHub", icon: "team", label: "Команда" }, { id: "me", icon: "stats", label: "Я" }];
  it("нижнее меню с чатом: круг справа от панели, в строку, число и подпись для экранного диктора", async () => {
    const { LiquidTabBar } = await import("../ui/tabbar.jsx");
    const html = R(h(LiquidTabBar, { tabs, activeId: "roleSelect", onTab: () => {}, a11y: false, onAi: () => {}, aiMode: "center", chat: { n: 3, label: "3", onOpen: () => {} } }));
    expect(html).toContain('data-chat-dock="bar"');
    expect(html).toContain('data-chat-dock-n="3"');
    expect(html).toContain('aria-label="Чат смены: непрочитанных 3"');
    expect(html).toContain("display:flex;align-items:center;gap:8px");
    expect(html.indexOf("data-tab-ai")).toBeLessThan(html.indexOf("data-chat-dock"));   // AI — в панели, чат — после неё
    const none = R(h(LiquidTabBar, { tabs, activeId: "roleSelect", onTab: () => {}, a11y: true, onAi: () => {}, aiMode: "center", chat: { n: 0, label: "", onOpen: () => {} } }));
    expect(none).toContain('aria-label="Чат смены"');
    expect(none).not.toContain("data-chat-dock-n");
    expect(R(h(LiquidTabBar, { tabs, activeId: "roleSelect", onTab: () => {}, a11y: false, onAi: () => {} }))).not.toContain("data-chat-dock");
  });
  it("лёжа (меню слева): чат под Наставником, с числом", async () => {
    const { NavRail } = await import("../ui/tabbar.jsx");
    const html = R(h(NavRail, { tabs, activeId: "me", onTab: () => {}, a11y: false, onAi: () => {}, chat: { n: 120, label: "99+", onOpen: () => {} } }));
    expect(html).toContain('data-chat-dock="rail"');
    expect(html).toContain('data-chat-dock-n="99+"');
    expect(html.indexOf("data-rail-ai")).toBeLessThan(html.indexOf('data-chat-dock="rail"'));
  });
  it("App: значка в верхней строке нет; круг — где есть меню, заведение и этап 38; узкий экран — подписи вкладок помельче", () => {
    const app = rd("App.jsx");
    expect(app).not.toContain("data-top-chat");
    expect(app).toContain("onAi={() => navigate(\"assistant\")} aiMode=\"center\" chat={chatDockProps} />;");
    expect(app).toContain("onAi={() => navigate(\"assistant\")} chat={chatDockProps} />");
    const tb = rd("ui/tabbar.jsx");
    expect(tb).toContain("const tight = cellW > 0 && cellW < 52;");
    expect(tb).toContain("fontSize: tight ? 10 : 11, fontFamily:\"Georgia, serif\", letterSpacing: tight ? 0 : 0.3,");
    expect(tb).toContain("Выбрал по кадрам из двух мест");
  });
  it("справка: «Круг с облачками рядом с нижним меню», очистка и удаление — без «слово — слово»", async () => {
    const { GUIDE } = await import("../ui/guide.jsx");
    const g = GUIDE.flatMap((x) => x.items || []).find((x) => x.key === "chat") || {};
    expect(g.text).toContain("Круг с облачками рядом с нижним меню открывает чат заведения");
    expect(g.text).toContain("Удалённое сообщение исчезает у всех целиком. Корзина в шапке чата очищает его у всех");
    expect(g.text.match(DASH)).toBe(null);
  });
});

describe("v91: демо чата", () => {
  it("круг чата у меню на снимке сборки v91; «Очистить чат» на демо-сервере: пусто, без строки, личная уходит из списка", async () => {
    expect(rd("tools/claude/chat-demo/build.mjs")).toContain("const HOME_BOX = { dark: { x: 325, y: 777, w: 58, h: 58, round: true }, light: { x: 325, y: 777, w: 58, h: 58, round: true } };");
    expect(rd("tools/claude/chat-demo/entry.jsx")).toContain('borderRadius: b.round ? "50%" : 11 * k');
    const { demoApi } = await import("../tools/claude/chat-demo/demo-api.js");
    const api = demoApi();
    expect((await api.clear("team")).ok).toBe(true);
    const t = await api.open("team");
    expect([t.msgs.length, t.pin, !!t.chat.cleared]).toEqual([0, null, true]);
    expect((await api.clear("dm-p3")).ok).toBe(true);
    expect((await api.list()).chats.map((c) => c.id)).not.toContain("dm-p3");
  });
});

describe("v91: документы", () => {
  it("README: e2e-v91, test38 — 110 проверок; supabase/README — перезапуск этапа 38; CHANGES: Дополнение 404; «сборка v91»", () => {
    const readme = rd("tools/claude/README.md");
    expect(readme).toContain("`e2e-v91.mjs` — v91 (Доп. 404)");
    expect(readme).toMatch(/\((110 проверок|1[2-9]\d проверк[иа])\)/);   // v92: 124 проверки (свои чаты)
    expect(rd("supabase/README.md")).toContain("v91: перезапусти `supabase-stage38-chat.sql`");
    expect(rd("CHANGES.md")).toContain("# Дополнение 404 — Чат смены: починка, круг у меню, «Очистить чат» (v91)");
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(9[1-9]|\d{3,})<\/span>/);
  });
});
