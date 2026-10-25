// v84 (Доп. 397): «Спасибо» от гостей по QR. У сотрудника — свой QR (lib/qr.js, без библиотек), гость сканирует и
// говорит спасибо на лёгкой странице без входа (?thanks=код, ui/guest-thanks.jsx); сотрудник видит свои спасибо,
// руководитель — команду; свежие спасибо — в брифинге смены. Вид и чтение QR камерой (OpenCV) — tools/claude/e2e-v84.mjs,
// сервер — tools/claude/sql/test34.sh.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { qrMatrix, qrPath, dataCodewords } from "../lib/qr.js";
import { THANKS_TAGS, tagLabel, posLabel, thanksCode, isThanksLink, thanksUrl, deviceId, thanksSub, tagsLine } from "../lib/guest-thanks.js";
import { briefGuests, buildBrief, briefText, BRIEF_ORDER } from "../lib/briefing.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; };
const URL1 = "https://service-academy-16te.vercel.app/?thanks=8457ea0e0b";

// поле формата: 15 бит рядом с левым верхним искателем → (уровень, маска); BCH-проверка
function readFormat(m) {
  let bits = 0;
  for (let i = 0; i <= 5; i++) bits |= (m[i][8] ? 1 : 0) << i;
  bits |= (m[7][8] ? 1 : 0) << 6; bits |= (m[8][8] ? 1 : 0) << 7; bits |= (m[8][7] ? 1 : 0) << 8;
  for (let i = 9; i < 15; i++) bits |= (m[8][14 - i] ? 1 : 0) << i;
  const v = bits ^ 0x5412, d = v >>> 10;
  let rem = d; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return { ecl: ["M", "L", "H", "Q"][d >>> 3], mask: d & 7, ok: ((d << 10) | (rem & 0x3ff)) === v };
}
const finderOk = (m, x0, y0) => { for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) { const dd = Math.max(Math.abs(dx - 3), Math.abs(dy - 3)); if (m[y0 + dy][x0 + dx] !== (dd !== 2)) return false; } return true; };

describe("v84: QR без библиотек", () => {
  it("ёмкость версий 1–10 на уровне M — по таблице стандарта", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => dataCodewords(v, 1))).toEqual([16, 28, 44, 64, 86, 108, 124, 154, 182, 216]);
    expect([1, 2, 3, 4, 5].map((v) => dataCodewords(v, 0))).toEqual([19, 34, 55, 80, 108]);   // L
  });
  it("ссылка «спасибо» — версия 4 (33×33): три искателя, синхрополосы, тёмный модуль, поле формата верное", () => {
    const q = qrMatrix(URL1, { ecl: "M" });
    expect([q.version, q.size]).toEqual([4, 33]);
    const m = q.modules;
    expect(finderOk(m, 0, 0) && finderOk(m, q.size - 7, 0) && finderOk(m, 0, q.size - 7)).toBe(true);
    for (let i = 8; i < q.size - 8; i++) { expect(m[6][i]).toBe(i % 2 === 0); expect(m[i][6]).toBe(i % 2 === 0); }
    expect(m[q.size - 8][8]).toBe(true);
    const f = readFormat(m);
    expect(f.ok).toBe(true);
    expect(f.ecl).toBe("M");
  });
  it("маска — с наименьшим штрафом; заданная маска — в поле формата; уровни L/Q/H пишутся верно", () => {
    for (const mask of [0, 3, 5, 7]) expect(readFormat(qrMatrix(URL1, { ecl: "M", mask }).modules)).toEqual({ ecl: "M", mask, ok: true });
    for (const ecl of ["L", "Q", "H"]) expect(readFormat(qrMatrix("HELLO", { ecl }).modules).ecl).toBe(ecl);
  });
  it("длинный текст — версия побольше (с полем версии от 7-й); не влезло в 10-ю — null; кириллица — UTF-8", () => {
    expect(qrMatrix("x".repeat(150), { ecl: "M" }).version).toBe(8);
    expect(qrMatrix("x".repeat(400), { ecl: "M" })).toBeNull();
    expect(qrMatrix("Спасибо", { ecl: "M" }).version).toBe(1);   // 14 байт
  });
  it("SVG-путь: тёмные модули строками, с полем 4 модуля", () => {
    const q = qrMatrix("A", { ecl: "M" });
    const p = qrPath(q, 4);
    expect(p.startsWith("M4 4h7v1h-7z")).toBe(true);   // верхняя строка левого искателя — одним прямоугольником
    expect(qrPath(null)).toBe("");
  });
});

describe("v84: страница гостя и данные", () => {
  it("за что спасибо — пять отметок, ключи как на сервере", () => {
    expect(THANKS_TAGS.map((x) => x[0])).toEqual(["care", "speed", "advice", "smile", "special"]);
    expect(rd("supabase/supabase-stage34-guest-thanks.sql")).toContain("select array['care', 'speed', 'advice', 'smile', 'special']");
    expect(tagLabel("advice")).toBe("Отличный совет");
  });
  it("код из адреса и ссылка для QR; должность по-русски", () => {
    expect(thanksCode("?thanks=8457ea0e0b")).toBe("8457ea0e0b");
    expect(thanksCode("?thanks=../../etc")).toBe("");
    expect(thanksCode("?go=brief")).toBe("");
    expect([isThanksLink("?thanks=xyz"), isThanksLink("?thanks="), isThanksLink("?go=thanks")]).toEqual([true, true, false]);
    expect(thanksUrl("https://app.example/", "8457ea0e0b")).toBe("https://app.example/?thanks=8457ea0e0b");
    expect([posLabel("waiter"), posLabel("BARTENDER"), posLabel("host"), posLabel("owner")]).toEqual(["Официант", "Бармен", "Хостес", ""]);
  });
  it("номер браузера гостя — случайный, один и тот же на этом телефоне", () => {
    const ls = mem();
    const a = deviceId(ls), b = deviceId(ls);
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(b).toBe(a);
    expect(deviceId(mem())).not.toBe(a);
  });
  it("подписи: пункт «Я» и отметки для руководителя", () => {
    expect(thanksSub({ week: 3, total: 10 })).toBe("3 раза за неделю гости сказали спасибо · твой QR");
    expect(thanksSub({ week: 0, total: 10 })).toBe("Всего спасибо от гостей: 10 · твой QR");
    expect(thanksSub(null)).toBe("Твой QR: гости говорят спасибо лично тебе");
    expect(tagsLine({ care: 3, advice: 5, junk: 9, smile: 0 })).toBe("отличный совет 5 · внимание к нам 3");
  });
  it("страница гостя: до ответа сервера — «Минуту…»; приложения в ней нет", async () => {
    const { GuestThanksPage } = await import("../ui/guest-thanks.jsx");
    const html = R(h(GuestThanksPage, { code: "8457ea0e0b" }));
    expect(html).toContain("Минуту…");
    expect(html).toContain("Service Academy");
    const src = rd("ui/guest-thanks.jsx");
    expect(src).not.toMatch(/from "\.\.\/App/);
    expect(src).toContain('rpc("guest_thanks_send", { p_code: code, p_tags: tags, p_text: text.trim(), p_device: deviceId() })');
  });
  it("main.jsx: ?thanks= — только страница гостя, без приложения и без сервис-воркера", () => {
    const m = code(rd("main.jsx"));
    expect(m).toContain('const GUEST_THANKS = typeof location !== "undefined" && isThanksLink(location.search);');
    expect(m).toContain('render(<GuestThanksPage code={thanksCode(location.search)} />);');
    expect(m).toContain('import("./ui/guest-thanks.jsx").then(({ GuestThanksPage }) => {');
    expect(m).toContain('if (!GUEST_THANKS && "serviceWorker" in navigator) {');
    expect(m).toMatch(/\} else \{\s*ReactDOM\.createRoot\(document\.getElementById\("root"\)\)\.render\(\s*<React\.StrictMode>/);
  });
});

describe("v84: в приложении", () => {
  const app = rd("App.jsx");
  it("«Я»: «Спасибо от гостей» первым в «Мой путь»; руководителю — и в «Команде»; экран лениво; ?go=thanks", () => {
    expect(app).toContain('const ThanksScreen = lazyOf(() => import("./ui/thanks"), "ThanksScreen");');
    expect(app).toContain('thanksOn && { key:"thanks", group:"Мой путь", icon:"thanks", label:"Спасибо от гостей", sub: thanksSub(thanksInfo), onClick:() => openThanks("mine") },');
    expect(app.indexOf('thanksOn && { key:"thanks"')).toBeLessThan(app.indexOf('mShown && { key:"mastery"'));
    expect(app).toContain('staff && thanksOn && { key:"thanksTeam", group:"Команда", icon:"thanks", label:"Спасибо от гостей"');
    expect(app).toMatch(/"cases", "thanks"[^\]]*\]\.includes\(v\)/);
    expect(app).toContain('else if (g === "thanks") { setThanksTab("mine"); navigate("thanks"); }');
    expect(rd("ui/home-hubs.jsx")).toContain("thanks: (c) => <svg");
  });
  it("подпись в «Я» — по my_thanks, но только у тех, кто открывал экран (код не создаётся каждому)", () => {
    expect(app).toContain('const thanksUsed = () => { try { return localStorage.getItem("sa_thanks_on" + ukP) === "1"; } catch (e) { return false; } };');
    expect(app).toContain('if (screen !== "me" || !storageLoaded || !profile || st.off || !thanksUsed() || Date.now() - st.at < 5 * 60e3) return;');
    expect(app).toContain('try { localStorage.setItem("sa_thanks_on" + ukP, "1"); } catch (e) {}');
  });
  it("экран: до ответа — «Загружаю…»; у руководителя вкладки «Мой QR» и «Команда»", async () => {
    const { ThanksScreen } = await import("../ui/thanks.jsx");
    const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, lessHead: {}, lessHeadTitle: {}, backBtn2: {} };
    const staff = R(h(ThanksScreen, { T, a11y: false, profile: { name: "Анна", position: "waiter" }, onBack: () => {} }));
    expect(staff).toContain("Спасибо от гостей");
    expect(staff).toContain("Загружаю…");
    expect(staff).not.toContain('data-thanks-tab="team"');
    const lead = R(h(ThanksScreen, { T, a11y: true, profile: { name: "Мария", position: "senior" }, lead: true, onBack: () => {} }));
    expect(lead).toContain('data-thanks-tab="team"');
  });
  it("«Напоминания в Telegram»: строка «Спасибо от гостей» — только когда сервер её знает", async () => {
    const { prefRows } = await import("../ui/day-cards");
    const base = { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: true, fresh: true, month: true };
    expect(prefRows(base).map((r) => r[0])).not.toContain("thanks");
    const rows = prefRows({ ...base, thanks: true });
    expect(rows[rows.length - 1]).toEqual(["thanks", "Спасибо от гостей", "когда гость сказал тебе спасибо по QR (первые три за день)"]);
  });
  it("тексты — без тире между словами и без восклицаний", () => {
    for (const f of ["ui/thanks.jsx", "ui/guest-thanks.jsx", "lib/guest-thanks.js"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
    }
  });
});

describe("v84: спасибо от гостей в брифинге смены", () => {
  const team = { ok: true, rows: [{ emp_id: "a", name: "Анна", week: 4, month: 9, tags: { care: 3, advice: 1 } }, { emp_id: "b", name: "Илья", week: 0, month: 2, tags: {} },
    { emp_id: "c", name: "Пётр", week: 1, month: 1, tags: { speed: 1 } }] };
  it("блок «Спасибо от гостей» после «Спасибо»: кого за неделю и за что; без этапа 34 — пусто", () => {
    expect(BRIEF_ORDER.indexOf("guests")).toBe(BRIEF_ORDER.indexOf("thanks") + 1);
    expect(briefGuests(team)).toEqual([{ name: "Анна", n: 4, tags: ["внимание", "совет по меню"] }, { name: "Пётр", n: 1, tags: ["быстро"] }]);
    expect(briefGuests({ ok: false })).toEqual([]);
    expect(briefGuests(null)).toEqual([]);
    const b = buildBrief({ guests: team, now: new Date(2026, 9, 25) });
    expect(b.on.guests).toBe(true);
    expect(briefText(b)).toContain("Гости сказали спасибо за неделю: Анна (4), Пётр (1)");
  });
});

describe("v84: этап 34 на сервере", () => {
  const sql = rd("supabase/supabase-stage34-guest-thanks.sql");
  it("гостю — только имя, должность и заведение; уволенный — not_found; повтор с телефона — раз в 12 часов; 40 в сутки", () => {
    expect(sql).toContain("return jsonb_build_object('ok', true, 'name', r.name, 'pos', r.pos, 'restaurant', r.restaurant);");
    expect(sql).toContain("if st is not null and st <> 'active' then return null; end if;");
    expect(sql).toContain("device = dev and created_at > now() - interval '12 hours'");
    expect(sql).toContain("if n >= 40 then return jsonb_build_object('ok', false, 'error', 'limit'); end if;");
    expect(sql).toContain("if n < 3 and _sa_tg_ready() then");
  });
  it("код — 10 знаков из случайного UUID; смена кода выключает старый", () => {
    expect(sql).toContain("c := left(replace(gen_random_uuid()::text, '-', ''), 10);");
    expect(sql).toContain("on conflict (emp_id) do update set code = excluded.code, updated_at = now();");
    expect(sql).toContain("if coalesce(p_code, '') !~ '^[a-z0-9]{10}$' then return null; end if;");
  });
  it("руководитель своего заведения: команда и «скрыть»; права — таблицы и служебное закрыты", () => {
    expect(sql).toContain("where id = p_id and restaurant is not distinct from nullif(btrim(coalesce(c->>'restaurant', '')), '');");
    expect(sql).toContain("revoke all on table sa_thanks_codes, sa_guest_thanks from public, anon, authenticated;");
    expect(sql).toContain("revoke all on function _sa_thanks_emp(text) from public, anon, authenticated;");
    expect(sql).toContain("grant execute on function guest_thanks_send(text, text[], text, text) to anon, authenticated;");
    expect(sql).toContain("alter table sa_notify_prefs add column if not exists thanks boolean not null default true;");
  });
});

describe("v84: метка и журнал", () => {
  it("«сборка v84», «Дополнение 397»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(8[4-9]|9\d|\d{3,})<\/span>/);   // v84 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 397 — «спасибо» от гостей по QR: гость сканирует и благодарит лично (v84)");
  });
});
