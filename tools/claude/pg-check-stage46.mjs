// tools/claude/pg-check-stage46.mjs — v130 (Доп. 443): этап 46 («Поделиться в чат» — вина и крепкое из «Барной карты») на
// настоящем Postgres против сервера демо. Владелец (02.11): «нужна ещё функция «поделиться в чат»… вина и крепкие не имеют
// такой возможности». Одни и те же карточки (вино с фото и подписью, крепкое, коктейль, вино с плохим id, без названия)
// идут в сервер демо (tools/claude/demo-app/fake-server.js) и в базу: до этапа 46 вино и крепкое — bad_request (сервер демо
// с opts.noStage46 — так же), после — карточка в «Вся команда» с подписью «Вино: …», «Крепкое: …» (как cardSummary в
// lib/chat-smart.js); в сетевой чат — нет (как блюда и коктейли); прежние виды не изменились; функции закрыты для anon.
// База — макет Supabase из tools/claude/sql: копия satest25 (сначала bash tools/claude/sql/run25.sh), сюда — этапы 26, 31,
// 32, 34–39 и 46 (дважды: можно запускать повторно); люди демо — со своими uuid, в ответах они заменяются обратно на id
// демо. PGHOST и PGPORT — как у tools/claude/sql (по умолчанию /tmp/pgsock и 5433).
// Запуск: PGHOST=<папка сокета> PGPORT=<порт> E2E_SRC=<исходники> node tools/claude/pg-check-stage46.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SRC = process.env.E2E_SRC || process.cwd();
const HOST = process.env.PGHOST || "/tmp/pgsock", PORT = process.env.PGPORT || "5433", BASE = process.env.PG_BASE || "satest25", DB = "sa_check46";
const { makeServer } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { cardSummary } = await import(SRC + "/lib/chat-smart.js");
const { drinkShareItem, cocktailShareItem } = await import(SRC + "/lib/share-items.js");
const { WINE, SPIRIT } = await import(SRC + "/lib/drinks.js");
const { normWine } = await import(SRC + "/lib/wine.js");
const { normSpirit } = await import(SRC + "/lib/spirit.js");

const psql = (args, input) => execFileSync("psql", ["-h", HOST, "-p", PORT, "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", ...args], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const jlit = (o) => lit(JSON.stringify(o)) + "::jsonb";
try { psql(["-d", "postgres", "-c", "drop database if exists " + DB, "-c", "create database " + DB + " template " + BASE]); }
catch (e) { console.log("✗ нет базы " + BASE + " — сначала bash tools/claude/sql/run25.sh\n" + String(e.stderr || e.message).slice(0, 400)); process.exit(1); }
const q1 = (sql) => psql(["-d", DB, "-At", "-c", sql]).trim();
const TZ = "Asia/Kamchatka";
const TODAY = q1(`select to_char((now() at time zone '${TZ}')::date, 'YYYY-MM-DD')`);

const R0 = "Два моря, Океан";
const PEOPLE = [
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false },
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const UID = Object.fromEntries(PEOPLE.map((p, i) => [p.id, "00000000-0000-4000-8046-" + String(i + 1).padStart(12, "0")]));
const TUID = Object.fromEntries(PEOPLE.map((p, i) => ["tok-" + p.id, "10000000-0000-4000-8046-" + String(i + 1).padStart(12, "0")]));
const U = (id) => UID[id] || id, TK = (t) => lit(TUID[t] || t);
const back = (txt) => Object.entries(UID).reduce((s, [id, u]) => s.split(u).join(id), String(txt));
const mk = (noStage46) => makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, noStage46 });
const srv0 = mk(true), srv = mk(false);

const fails = [];
const ok = (name, cond, extra = "") => { console.log((cond ? "✓ " : "✗ ") + name + (cond || !extra ? "" : " — " + extra)); if (!cond) fails.push(name); };

// ── та же база в Postgres: чат команды (этапы до 39), люди и их входы; этап 46 — позже ──
for (const n of ["26-mastery", "31-qday", "32-briefing", "34-guest-thanks", "35-seating", "36-comfort", "37-halls-qday", "38-chat", "39-everyday"])
  psql(["-d", DB, "-f", SRC + "/supabase/supabase-stage" + n + ".sql"]);
const L = ["set client_min_messages = warning;", "delete from tg_links; delete from sessions; delete from employees;"];
for (const p of PEOPLE) L.push(`insert into employees (id, name, surname, restaurant, position, is_admin) values (${lit(U(p.id))}, ${lit(p.name)}, ${lit(p.surname)}, ${lit(p.restaurant)}, ${lit(p.position)}, ${p.is_admin});`);
for (const [t, id] of Object.entries(TOK)) L.push(`insert into sessions (token, employee_id) values (${TK(t)}, ${lit(U(id))});`);
const dir = mkdtempSync(join(tmpdir(), "pg46-"));
writeFileSync(join(dir, "fx.sql"), L.join("\n"));
psql(["-d", DB, "-f", join(dir, "fx.sql")]);

// ответы: id людей — как в демо; время, номера сообщений и чатов, отметки прочтения — не сравниваем (у сервера свои)
const pg = (fn, args) => JSON.parse(back(q1(`select ${fn}(${args})`)));
const SKIP = new Set(["at", "id", "chat", "upd", "seen", "reads", "read", "edited", "mine", "me"]);
const strip = (x) => {
  if (Array.isArray(x)) return x.map(strip);
  if (!x || typeof x !== "object") return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) { if (SKIP.has(k) && typeof v !== "object") continue; o[k] = strip(v); }
  return o;
};
// неразрывный пробел (цены «5 200 ₽»): сервер его бережёт, демо (\s в JS) делает обычным — для сравнения одинаково
const canon = (v) => JSON.stringify(strip(v), (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x)).replace(/\u00a0/g, " ");
const fk = (s, fn, tok, args = {}) => s.rpc(fn, { p_token: tok, ...args });
const send = (tok, card, chat = null) => pg("chat_card_send", `${TK(tok)}, ${chat == null ? "null" : chat}, ${jlit(card)}`);
const pick = (m) => (m && m.msg ? { body: m.msg.body, card: m.msg.card, kind: m.msg.kind, who: m.msg.emp || m.msg.who || null } : m);

// карточки — как их собирает приложение (lib/share-items.js)
const WN = normWine({ name: "Шабли", producer: "Domaine Laroche", country: "Франция", region: "Бургундия", grapes: ["шардоне"], color: "white", sweet: "сухое", vintage: "2022",
  byGlass: true, priceGlass: 950, priceBottle: 5200, img: "https://photos.e2e/dva-morya/w-cha.jpg" }, { id: "w-cha" });
const SP = normSpirit({ name: "Glenfiddich 12", cat: "whisky", style: "односолодовый", country: "Шотландия", region: "Спейсайд", age: "12 лет", abv: 40, portion: 40, pricePortion: 650, priceBottle: 9800 }, { id: "sp-gle" });
const wineIt = drinkShareItem(WINE, WN), spiritIt = drinkShareItem(SPIRIT, SP);
const ckIt = cocktailShareItem({ id: "negroni", name: "Негрони", ing: [["Джин", 30], ["Кампари", 30], ["Красный вермут", 30]] });
ok("карточки из приложения: вино с фото и подписью, крепкое, коктейль", wineIt.kind === "wine" && wineIt.title === "Шабли 2022" && /Бургундия/.test(wineIt.sub) && /950/.test(wineIt.sub) && wineIt.img.startsWith("https://")
  && spiritIt.kind === "spirit" && spiritIt.title === "Glenfiddich 12" && /40 мл 650/.test(spiritIt.sub.replace(/\u00a0/g, " ")) && ckIt.kind === "cocktail", JSON.stringify([wineIt, spiritIt]));
const share = (item, note = "") => ({ t: "share", item, ...(note ? { note } : {}) });

// ── до этапа 46: вино и крепкое — bad_request; блюдо и коктейль — как были ──
for (const [name, it] of [["вино", wineIt], ["крепкое", spiritIt]]) {
  const a = send("tok-u-maria", share(it)), b = fk(srv0, "chat_card_send", "tok-u-maria", { p_chat: null, p_card: share(it) });
  ok("до этапа 46 " + name + " — bad_request (и в демо без этапа)", a.error === "bad_request" && b.error === "bad_request", JSON.stringify([a, b]));
}
{ const a = pick(send("tok-u-maria", share(ckIt))), b = pick(fk(srv0, "chat_card_send", "tok-u-maria", { p_chat: null, p_card: share(ckIt) }));
  fk(srv, "chat_card_send", "tok-u-maria", { p_chat: null, p_card: share(ckIt) });   // и в демо с этапом — лента та же, что в базе
  ok("до этапа 46 коктейль уходит, как раньше", canon(a) === canon(b) && a.body === "Коктейль: Негрони", "\n   pg:   " + canon(a) + "\n   демо: " + canon(b)); }

// ── этап 46 (дважды) ──
const r1 = psql(["-d", DB, "-At", "-f", SRC + "/supabase/supabase-stage46-bar-share.sql"]).trim();
const r2 = psql(["-d", DB, "-At", "-f", SRC + "/supabase/supabase-stage46-bar-share.sql"]).trim();
ok("этап 46 ставится и запускается повторно: «можно делиться · подпись: Вино: Шабли»", r1 === r2 && r1 === "чат: вина и крепкое — можно делиться · подпись: Вино: Шабли", JSON.stringify([r1, r2]));

// ── после: вино и крепкое — карточками в «Вся команда», как в демо ──
for (const [name, it, tok, note] of [["вино (Мария, с парой слов)", wineIt, "tok-u-maria", "Новинка бокалом"], ["крепкое (Илья)", spiritIt, "tok-e-ilya", ""], ["вино (Анна)", wineIt, "tok-e-anna", ""]]) {
  const a = pick(send(tok, share(it, note))), b = pick(fk(srv, "chat_card_send", tok, { p_chat: null, p_card: share(it, note) }));
  ok("после этапа 46: " + name + " — карточка как в демо", canon(a) === canon(b), "\n   pg:   " + canon(a) + "\n   демо: " + canon(b));
  ok("    подпись — «" + a.body + "», как cardSummary приложения", a.body === cardSummary(a.card) && a.body === (it.kind === "wine" ? "Вино: " : "Крепкое: ") + it.title, a.body);
}
{ const it = { ...wineIt, img: "data:image/png;base64,AAAA", sub: "x".repeat(300) };
  const a = pick(send("tok-u-maria", share(it))), b = pick(fk(srv, "chat_card_send", "tok-u-maria", { p_chat: null, p_card: share(it) }));
  ok("фото не https — без фото, подпись режется до 140 (и в демо)", canon(a) === canon(b) && !a.card.item.img && a.card.item.sub.length <= 140, "\n   pg:   " + canon(a) + "\n   демо: " + canon(b)); }
for (const [name, it] of [["плохой id", { ...wineIt, id: "w cha" }], ["без названия", { ...spiritIt, title: "  " }], ["неизвестный вид", { ...wineIt, kind: "beer" }]]) {
  const a = send("tok-u-maria", share(it)), b = fk(srv, "chat_card_send", "tok-u-maria", { p_chat: null, p_card: share(it) });
  ok(name + " — bad_request (и в демо)", a.error === "bad_request" && b.error === "bad_request", JSON.stringify([a, b]));
}
// в сетевой чат — нет: вид пропускается только там, где коктейль
ok("сетевой чат: вино и крепкое не проходят, урок — проходит", q1(`select (_sa_chat_item(${jlit(wineIt)}, array['lesson', 'quiz', 'module', 'ref']) is null)::text || ',' ||
  (_sa_chat_item(${jlit(spiritIt)}, array['lesson', 'quiz', 'module', 'ref']) is null)::text || ',' || (_sa_chat_item('{"kind":"lesson","id":"s0-1","title":"Урок"}'::jsonb, array['lesson', 'quiz', 'module', 'ref']) is not null)::text`) === "true,true,true");
{ const net = srv.S.chats.find((c) => c.kind === "net"), b = fk(srv, "chat_card_send", "tok-u-maria", { p_chat: net.id, p_card: share(wineIt) });
  ok("    демо: в сетевой чат вино — bad_request", b.error === "bad_request", JSON.stringify(b)); }
// ответ Наставника (карточки): вино и крепкое — да, как коктейль; задание — только уроки и темы
ok("карточки Наставника пропускают вино и крепкое; задание — нет", q1(`select (_sa_chat_item(${jlit(wineIt)}, array['dish', 'cocktail', 'ref', 'lesson', 'quiz', 'module']) ->> 'kind') || ',' ||
  coalesce(_sa_chat_item(${jlit(wineIt)}, array['lesson', 'quiz', 'module']) ->> 'kind', 'нет')`) === "wine,нет");
// прежние подписи не изменились
const SUMS = [["dish", "Блюдо"], ["cocktail", "Коктейль"], ["ref", "Справочник"], ["lesson", "Урок"], ["quiz", "Тест"], ["module", "Тема"], ["wine", "Вино"], ["spirit", "Крепкое"], ["beer", "Карточка"]];
ok("подписи карточек: блюдо, коктейль, справочник, урок, тест, тема — как были; вино, крепкое — новые", SUMS.every(([k, w]) => q1(`select _sa_chat_card_sum(${jlit({ t: "share", item: { kind: k, title: "X" } })})`) === w + ": X"),
  SUMS.map(([k]) => q1(`select _sa_chat_card_sum(${jlit({ t: "share", item: { kind: k, title: "X" } })})`)).join(" | "));
ok("    и в приложении (cardSummary): вино, крепкое", cardSummary({ t: "share", item: { kind: "wine", title: "X" } }) === "Вино: X" && cardSummary({ t: "share", item: { kind: "spirit", title: "X" } }) === "Крепкое: X");
// в ленте чата у Анны — обе карточки, как в демо
{ const team = q1(`select id from sa_chats where restaurant = ${lit(R0)} and kind = 'team'`);
  const a = pg("chat_open", `${TK("tok-e-anna")}, ${team}`), fkTeam = srv.S.chats.find((c) => c.kind === "team");
  const b = fk(srv, "chat_open", "tok-e-anna", { p_chat: fkTeam.id });
  const cards = (r) => ((r && r.msgs) || []).filter((m) => m && m.card && m.card.t === "share").map((m) => m.body);
  ok("лента «Вся команда» у Анны: те же карточки и подписи, что в демо", Array.isArray(cards(a)) && canon(cards(a)) === canon(cards(b)) && cards(a).length === 5, "\n   pg:   " + canon(cards(a)) + "\n   демо: " + canon(cards(b))); }
// экран «Сервер» у владельца: этап 46 узнаётся по _sa_chat_bar_kinds (до этапа его нет — как в демо с noStage46)
{ const { STAGES } = await import(SRC + "/lib/server-check.js");
  const st = STAGES.find((x) => x.n === "46");
  const a = pg("server_check", `${TK("tok-u-roman")}, array[${lit(st.fn)}, 'chat_person']`), b = fk(srv, "server_check", "tok-u-roman", { p_fns: [st.fn, "chat_person"] }), c = fk(srv0, "server_check", "tok-u-roman", { p_fns: [st.fn, "chat_person"] });
  ok("«Сервер» видит этап 46 (как демо), без этапа — нет", st.file === "supabase-stage46-bar-share.sql" && canon(a.fns) === canon(b.fns) && a.fns.includes(st.fn) && !c.fns.includes(st.fn) && c.fns.includes("chat_person"), JSON.stringify([a.fns, b.fns, c.fns])); }
// права: служебные функции закрыты
ok("служебные функции закрыты для anon и authenticated", q1(`select has_function_privilege('anon', '_sa_chat_item(jsonb, text[])', 'execute')::text || has_function_privilege('authenticated', '_sa_chat_card_sum(jsonb)', 'execute')::text || has_function_privilege('anon', '_sa_chat_bar_kinds(text[])', 'execute')::text`) === "falsefalsefalse");

console.log("\n" + (fails.length ? "✗ не совпало: " + fails.length : "✓ всё совпало"));
process.exit(fails.length ? 1 : 0);
