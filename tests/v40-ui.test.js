// v40: «Путь мастера» — интерфейс. Медали и значки семейств, карточка на главной («Шаг дня» и строка пути),
// поздравления (новый значок, «Первые шаги», «Мастер роли ✦»), экран «Путь мастера» (главная награда,
// условия, приз, первые шаги в академии, 14 значков, шторка значка, мастера заведения, сертификат) и сертификат
// картинкой (lib/master-image.js). Здесь — разметка и тексты; вид в обеих темах на 320–430 px —
// в браузере: /home/claude/preview/mastery-harness (shoot.mjs, interact.mjs).
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { FAMILIES, masteryState, stepOfDay } from "../lib/mastery";
import { tierColor, tierText, FamIcon, Medal, MasteryHomeCard, BadgeToast, toastLine, msTie } from "../ui/mastery-card";
import { MasteryScreen, shortDay, topBadges } from "../ui/mastery";
import { masterShareText, drawMaster, masterDate, masterImage, MASTER_PARTS, MASTER_W, MASTER_H } from "../lib/master-image";
import { S, A } from "../ui/styles";

const noop = () => {};
const h = React.createElement;
// <!-- --> между текстами и неразрывные пробелы (переносы только между частями) — не мешают искать тексты
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const count = (html, re) => (html.match(re) || []).length;
const text = (html) => html.replace(/<[^>]+>/g, "");   // только текст, без тегов
const NOW = new Date(2026, 9, 15, 12);
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function mem() { const o = {}; return { get length() { return Object.keys(o).length; }, key: (i) => Object.keys(o)[i], getItem: (k) => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: (k) => { delete o[k]; } }; }

// три сотрудника: новичок (неделя идёт, 2 из 7), середина пути (6 значков: 2 серебра, 1 золото; мастер 7 из 13)
// и мастер роли (12 значков)
const FACTS = {
  newbie: { life: { w: 1, r: 1, st: 2 }, sectionsDone: 0, sectionsTotal: 12, perfectTests: 0, gold: 0, streakBest: 1, questsDone: 0, hallSkills: 0, roleDone: false, firstDay: "2026-10-10", streakNow: 1, mistakesDue: 0, shiftToday: null },
  mid: { life: { st: 120, l: 30, p: 8, q: 9, s: 46, d: 3, w: 40, r: 1, g: 0, m: 4, f: 2, u: 2, o: 0 }, sectionsDone: 9, sectionsTotal: 12, perfectTests: 2, gold: 0, streakBest: 14, questsDone: 0, hallSkills: 0, roleDone: false, firstDay: "2026-08-01", streakNow: 3, mistakesDue: 0, shiftToday: null },
  master: { life: { st: 400, l: 60, p: 20, q: 20, s: 120, d: 12, w: 42, r: 5, g: 3, m: 60, f: 8, u: 16, o: 6 }, sectionsDone: 12, sectionsTotal: 12, roleDone: true, perfectTests: 6, gold: 6, streakBest: 21, questsDone: 0, hallSkills: 0, firstDay: "2026-07-01", streakNow: 5, mistakesDue: 0, shiftToday: null },
};
const stateOf = (fx, facts) => masteryState(facts || FACTS[fx], "core", { now: NOW });
const stepOf = (fx, faded) => stepOfDay({ state: stateOf(fx), facts: FACTS[fx], uk: "_t" + fx, storage: mem(), day: ymd(NOW), faded: faded || [] });
const PROFILE = { name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан" };
const MASTERS = { status: "ok", prize: "Ужин на двоих в «Океане»", can_prize: false, rows: [
  { who: "Мария Лебедева", name: "Мария", role: "core", at: new Date(2026, 9, 12, 18, 20).toISOString(), me: false },
  { who: "Илья Соколов", name: "Илья", role: "bar", at: "2026-10-03", me: false },
  { who: "Анна Смирнова", name: "Анна", role: "seasonal", at: "2026-09-21", me: true }] };
const screen = (fx, more = {}) => R(h(MasteryScreen, { T: S, a11y: false, profile: PROFILE, role: "core", state: stateOf(fx), step: stepOf(fx), earned: { tiers: {}, fw: false, master: {} },
  seen: {}, masters: MASTERS, onGo: noop, onPrize: noop, onReloadMasters: noop, onBack: noop, inline: true, ...more }));
const between = (html, from, to) => { const i = html.indexOf(from); if (i < 0) return ""; const j = html.indexOf(to, i + from.length); return html.slice(i, j < 0 ? undefined : j); };
// все размеры шрифта в style: подписи и метки (моноширинные) отдельно
function fontSizes(html) {
  return [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]).filter((st) => /font-size:/.test(st))
    .map((st) => ({ px: parseFloat(st.match(/font-size:([\d.]+)px/)[1]), mono: /monospace/.test(st) }));
}

describe("v40 UI: металл ступеней, значки семейств, медаль", () => {
  it("tierColor: бронза, серебро, золото; в светлой теме темнее (рамки на пергаменте); вне 0…3 — к краю", () => {
    expect([1, 2, 3].map((t) => tierColor(t, false))).toEqual(["#C98B5F", "#C9CED6", "#E8C56A"]);
    const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
    for (const t of [1, 2, 3]) {
      expect(tierColor(t, true)).toMatch(/^#[0-9A-F]{6}$/i);
      expect(lum(tierColor(t, true))).toBeLessThan(lum(tierColor(t, false)));
      expect(lum(tierText(t, true))).toBeLessThan(lum(tierColor(t, true)));   // надписи — ещё темнее
    }
    expect(tierColor(9, false)).toBe(tierColor(3, false));
    expect(tierColor(-1, true)).toBe(tierColor(0, true));
  });

  it("FamIcon: своя линия 24×24 для каждого из 14 семейств, «Первой недели» и «Мастера роли»; все разные", () => {
    const ids = [...FAMILIES.map((f) => f.id), "first", "master"];
    expect(ids.length).toBe(16);
    const inner = ids.map((id) => {
      const html = R(h(FamIcon, { id, size: 30, color: "#123456" }));
      expect(html.startsWith("<svg"), id).toBe(true);
      expect(html, id).toContain('viewBox="0 0 24 24"');
      expect(html, id).toContain('width="30"');
      expect(html, id).toContain('stroke="#123456"');
      expect(html, id).toContain('aria-hidden="true"');
      expect(html, id).toMatch(/<(path|circle|rect)/);
      return html.replace(/^<svg[^>]*>/, "");
    });
    expect(new Set(inner).size).toBe(16);
    expect(R(h(FamIcon, { id: "нет такого" }))).toBe(R(h(FamIcon, { id: "track" })));   // запасной — трек
  });

  it("Medal: силуэт без ступени (пунктир, «ещё не получен»), металл и подпись ступени; кольцо пути", () => {
    const locked = R(h(Medal, { id: "fresh", tier: 0 }));
    expect(locked).toContain('role="img"');
    expect(locked).toContain('aria-label="Свежесть тем — ещё не получен"');
    expect(locked).toContain('stroke-dasharray="3.2 3.3"');
    expect(locked).not.toContain("linearGradient");
    const started = R(h(Medal, { id: "fresh", tier: 0, pct: 0.5 }));
    expect(started).not.toContain('stroke-dasharray="3.2 3.3"');   // путь начат — сплошной контур
    expect(started).toContain('stroke-dasharray="92.99 185.98"');   // половина кольца r = 29,6
    expect(R(h(Medal, { id: "fresh", tier: 0, locked: true, pct: 0 }))).toContain("ещё не получен");
    expect(R(h(Medal, { id: "fresh", tier: 1 }))).toContain('aria-label="Свежесть тем — бронза"');
    const silver = R(h(Medal, { id: "fresh", tier: 2, pct: 0.25 }));
    expect(silver).toContain('aria-label="Свежесть тем — серебро"');
    expect(silver).toContain("linearGradient");
    expect(silver).toContain('stroke="#E8C56A"');                    // кольцо — цветом следующей ступени (золото)
    expect(R(h(Medal, { id: "warmup", tier: 3 }))).toContain('aria-label="Разминка до смены — золото"');
    expect(R(h(Medal, { id: "warmup", tier: 3, ring: false }))).not.toContain('stroke-width="3"');
    expect(R(h(Medal, { id: "first", tier: 3, ring: false }))).toContain('aria-label="Первые шаги ✦ — получен"');
    const master = R(h(Medal, { id: "master", tier: 3, ring: false, size: 96 }));
    expect(master).toContain('aria-label="Мастер роли ✦ — получен"');
    expect(count(master, /L/g)).toBeGreaterThan(100);                 // фестончатый край печати
    expect(R(h(Medal, { id: "master", tier: 0, ring: false }))).toContain("Мастер роли ✦ — ещё не получен");
    // у каждой медали свои градиенты — несколько на одном экране не путаются
    const two = R(h("div", null, h(Medal, { id: "gold", tier: 3 }), h(Medal, { id: "gold", tier: 3 })));
    const ids = [...two.matchAll(/linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("v40 UI: карточка на главной", () => {
  it("середина пути: «Шаг дня» (текст, что внутри, «Сделать») и строка пути «6 из 14 значков · мастер роли 7/13»", () => {
    const st = stateOf("mid"), step = stepOf("mid", [{ id: "m1", title: "Встреча гостя" }]);
    expect(step.text).toBe("Освежи тему «Встреча гостя»");
    const html = R(h(MasteryHomeCard, { a11y: false, step, state: st, newCount: 0, onStep: noop, onOpen: noop }));
    expect(html).toContain("data-ms-home");
    expect(html).toContain("data-ms-step");
    expect(html).toContain("data-ms-open");
    expect(between(html, "data-ms-step", "data-ms-open")).toContain("Шаг дня");
    expect(html).toContain("Освежи тему «Встреча гостя»");
    expect(html).toContain("3 ситуации · 1 мин — тема снова свежая");
    expect(html).toContain(">Сделать<");
    expect(html).toContain("Путь мастера");
    expect(html).toContain("6 из 14 значков · мастер роли 7/13");
    expect(html).not.toContain("новое");
    expect(html).not.toContain("новых");
    expect(count(html, /role="button"/g)).toBe(2);
  });

  it("«новое»: одно — «новое», несколько — «N новых»", () => {
    const st = stateOf("mid");
    expect(R(h(MasteryHomeCard, { step: null, state: st, newCount: 1 }))).toContain(">новое<");
    expect(R(h(MasteryHomeCard, { step: null, state: st, newCount: 3 }))).toContain(">3 новых<");
  });

  it("шаг сделан — «Шаг дня сделан ✓», «Завтра будет новый», без «Сделать»; мастер — «Мастер роли ✦ · 12 из 14 значков»", () => {
    const html = R(h(MasteryHomeCard, { a11y: true, step: { ...stepOf("mid"), done: true }, state: stateOf("master") }));
    expect(html).toContain("Шаг дня сделан ✓");
    expect(html).toContain("Завтра будет новый");
    expect(html).not.toContain(">Сделать<");
    expect(html).toContain("Мастер роли ✦ · 12 из 14 значков");
    expect(html).toContain('aria-label="Мастер роли ✦ — получен"');
  });

  it("новичок: «Первые шаги в академии · 3 из 7» — семь точек, три закрашены", () => {
    const facts = { ...FACTS.newbie, life: { w: 1, r: 1, m: 1, st: 3 } };
    const st = stateOf("newbie", facts);
    expect([st.firstWeek.active, st.firstWeek.done]).toEqual([true, 3]);
    const html = R(h(MasteryHomeCard, { step: stepOf("newbie"), state: st }));
    expect(html).toContain("Первые шаги в академии");
    expect(html).toContain(">3 из 7<");
    expect(count(html, /class="ms-dot/g)).toBe(7);
    expect(count(html, /class="ms-dot on"/g)).toBe(3);
    expect(html).not.toContain("Путь мастера<");
  });

  it("шага нет — только строка пути; нет ни шага, ни состояния — ничего", () => {
    const html = R(h(MasteryHomeCard, { step: null, state: stateOf("mid") }));
    expect(html).not.toContain("data-ms-step");
    expect(html).toContain("data-ms-open");
    expect(R(h(MasteryHomeCard, { step: null, state: null }))).toBe("");
  });

  it("длинный шаг — до трёх строк, подпись — одна; светлая тема — текст от 13 px, метки от 11 px", () => {
    const step = { id: "tier:fixes", text: "Ещё 12 исправленных ошибок до серебра «Работа над ошибками»", sub: "Открой «Работу над ошибками» и ответь верно там, где раньше ошибся.", go: "mistakes", done: false, kind: "tier", fam: "fixes" };
    const html = R(h(MasteryHomeCard, { a11y: true, step, state: stateOf("mid"), newCount: 2 }));
    expect(html).toContain('class="ms-clamp ms-l3"');
    expect(html).toContain('class="ms-clamp ms-l1"');
    for (const f of fontSizes(html)) expect(f.px).toBeGreaterThanOrEqual(f.mono ? 11 : 13);
    for (const f of fontSizes(R(h(MasteryHomeCard, { a11y: false, step, state: stateOf("mid"), newCount: 2 })))) expect(f.px).toBeGreaterThanOrEqual(f.mono ? 10 : 12);
  });
});

describe("v40 UI: поздравления", () => {
  const toastState = stateOf("mid", { ...FACTS.mid, life: { ...FACTS.mid.life, u: 15 } });
  it("новая ступень: плашка (role=status), медаль, «✦ Новый значок · серебро», название, строка из состояния, «Путь мастера ›»", () => {
    const html = R(h(BadgeToast, { a11y: false, item: { kind: "tier", id: "fresh", title: "Свежесть тем", tier: 2 }, state: toastState, onOpen: noop, onClose: noop, inline: true }));
    expect(html).toContain("data-ms-toast");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Свежесть тем — серебро"');
    expect(html).toContain("✦ Новый значок · серебро");
    expect(html).toMatch(/text-transform:uppercase[^"]*">✦ Новый значок · серебро/);
    expect(html).toContain(">Свежесть тем<");
    expect(html).toContain("15 тем освежено · до золота ещё 25");
    expect(html).toContain("Путь мастера ›");
    expect(html).toContain('aria-label="Закрыть"');
    expect(html).not.toContain("data-sa-back");   // плашка не модальная: «назад» Telegram — экрану, не ей
  });

  it("золото — «высшая ступень ✦»; «Первые шаги ✦» — «7 первых шагов за первые две недели»", () => {
    expect(toastLine({ kind: "tier", id: "warmup", tier: 3 }, toastState)).toBe("40 разминок · высшая ступень ✦");
    expect(toastLine({ kind: "tier", id: "нет" }, toastState)).toBe("");
    expect(toastLine({ kind: "tier", id: "fresh" }, null)).toBe("");
    const html = R(h(BadgeToast, { item: { kind: "firstWeek" }, state: toastState, inline: true }));
    expect(html).toContain("✦ Новый значок<");
    expect(html).toContain(">Первые шаги ✦<");
    expect(html).toContain("7 первых шагов за первые две недели");
    expect(html).toContain('aria-label="Первые шаги ✦ — получен"');
  });

  it("«Мастер роли ✦» — окно по центру: печать, искры, «✦ Главная награда», «Сертификат мастера ›» и «Позже» (data-sa-back)", () => {
    const html = R(h(BadgeToast, { a11y: true, item: { kind: "master", role: "core" }, state: stateOf("master"), onOpen: noop, onClose: noop, inline: true }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("data-ms-toast");
    expect(html).toContain("✦ Главная награда");
    expect(html).toContain(">Мастер роли «Ядро» ✦<");
    expect(html).toContain("Роль пройдена, 5 золотых тем, серия 14 дней и 10 значков. Коллеги увидят знак ✦ у твоего имени.");
    expect(html).toContain("Сертификат мастера ›");
    expect(html).toMatch(/data-sa-back=""[^>]*>Позже</);
    expect(count(html, /<i style="--dx:/g)).toBe(12);
    expect(R(h(BadgeToast, { item: { kind: "master", role: "x" }, inline: true }))).toContain(">Мастер роли ✦<");
  });

  it("нет события — ничего", () => {
    expect(R(h(BadgeToast, { item: null, inline: true }))).toBe("");
    expect(R(h(BadgeToast, { item: {}, inline: true }))).toBe("");
  });
});

describe("v40 UI: экран «Путь мастера»", () => {
  it("шапка и главная награда: кольцо «7 из 13», четыре условия с прогрессом, «До звания — ещё 6 из 13», приз заведения", () => {
    const html = screen("mid");
    expect(html).toContain("data-ms-screen");
    expect(html).toContain('aria-label="Назад"');
    expect(html).toContain(">Путь мастера<");
    expect(html).toContain("роль «Ядро»");
    const hero = between(html, "data-ms-hero", "data-ms-step");
    expect(hero).toContain("✦ Главная награда");
    expect(hero).toContain("Мастер роли «Ядро» ✦");
    expect(hero).toContain('aria-label="Мастер роли: 7 из 13"');
    expect(hero).toMatch(/>7<\/text><text[^>]*>из 13</);
    expect(text(hero)).toContain("До звания — ещё 6 из 13. Коллеги-мастера носят знак ✦ у имени в рейтинге и лиге.");
    expect(hero).toContain(">До звания — ещё 6 из 13.</b>");
    const parts = [...hero.matchAll(/data-ms-part="(\w+)" aria-label="([^"]+)"/g)].map((m) => [m[1], m[2]]);
    expect(parts).toEqual([["role", "Роль пройдена — 9 из 12 разделов"], ["gold", "5 золотых тем — 0 из 5"], ["streak", "Серия 14 дней — готово"], ["bronze", "Бронза в 10 значках — 6 из 10"]]);
    expect(hero).toContain("лучшая: 14 из 14");
    expect(text(hero)).toContain("Приз заведения для мастеров: Ужин на двоих в «Океане»");
    expect(hero).toContain("data-ms-prize");
    expect(hero).not.toContain("Назначить приз");     // назначать может только руководитель
    expect(hero).not.toContain("Сертификат мастера");
    expect(html).toContain("Значки считаются на этом телефоне по твоим занятиям. Руководитель видит их в отчёте.");
  });

  it("«Шаг дня» крупно: текст, что внутри, «Сделать ›»; сделан — «Шаг дня сделан ✓» без кнопки", () => {
    const html = screen("mid");
    const card = between(html, "data-ms-step", "data-ms-badges");
    expect(card).toContain("Шаг дня");
    expect(card).toContain(stepOf("mid").text);
    expect(card).toContain("Сделать ›");
    const done = between(screen("mid", { step: { ...stepOf("mid"), done: true } }), "data-ms-step", "data-ms-badges");
    expect(done).toContain("Шаг дня сделан ✓");
    expect(done).toContain("Завтра будет новый");
    expect(done).not.toContain("Сделать ›");
    expect(screen("mid", { step: null })).not.toContain("data-ms-step");
  });

  it("значки: 14 плиток в порядке семейств, «Значки · 6 из 14», силуэты (data-ms-locked) и «новое» (data-ms-new)", () => {
    const html = screen("mid", { seen: { guest: "2026-10-01" } });
    expect(html).toContain("Значки · 6 из 14");
    expect([...html.matchAll(/data-ms-badge="(\w+)"/g)].map((m) => m[1])).toEqual(FAMILIES.map((f) => f.id));
    const tile = (id) => { const m = html.match(new RegExp('<button[^>]*data-ms-badge="' + id + '"[^>]*>([\\s\\S]*?)</button>')); return m ? m[0] : ""; };
    expect(["gold", "guest", "quest", "hall"].map((id) => tile(id).includes("data-ms-locked"))).toEqual([true, true, true, true]);
    expect(["track", "fresh", "warmup", "radio"].map((id) => tile(id).includes("data-ms-locked"))).toEqual([false, false, false, false]);   // начат или есть ступень
    expect(FAMILIES.map((f) => f.id).filter((id) => tile(id).includes("data-ms-new"))).toEqual(["gold", "quest", "hall"]);   // гость уже открыт
    expect(tile("track")).toContain("Трек — серебро");
    expect(tile("track")).toContain(">серебро<");
    expect(tile("warmup")).toContain(">золото ✦<");
    expect(tile("fresh")).toContain(">2 из 3<");
    expect(tile("guest")).toContain(">как получить<");
    expect(tile("table")).toContain("Практика у стола");
  });

  it("первая неделя: идёт — «3 из 7 · осталось 9 дней», задания со «Открыть ›»; вся сделана или значок есть — строка «получен»; прошла — нет блока", () => {
    const st = stateOf("newbie", { ...FACTS.newbie, life: { w: 1, r: 1, m: 1, st: 3 }, firstDay: "2026-10-10" });
    const html = R(h(MasteryScreen, { T: S, profile: PROFILE, role: "core", state: st, step: null, earned: {}, masters: null, inline: true }));
    const first = between(html, "data-ms-first", "data-ms-badges");
    expect(first).toContain("Первые шаги в академии");
    expect(first).toContain("3 из 7 · осталось 9 дней");
    expect(count(first, /data-ms-mission="/g)).toBe(7);
    expect(count(first, />сделано</g)).toBe(3);
    expect(count(first, /Открыть ›/g)).toBe(4);
    expect(first).toContain("Обслужи живого гостя");
    expect(first).toContain("Все семь — значок «Первые шаги ✦».");
    expect(screen("mid")).not.toContain("data-ms-first");   // давно в академии, неделя не собрана — блока нет
    const all = stateOf("newbie", { ...FACTS.newbie, life: { w: 1, d: 1, p: 1, r: 1, g: 1, m: 1, q: 1 }, firstDay: "2026-10-10" });
    expect(R(h(MasteryScreen, { T: S, state: all, role: "core", inline: true }))).toContain("Значок «Первые шаги» получен ✦");
    expect(screen("mid", { earned: { tiers: {}, fw: true, master: {} } })).toContain("Значок «Первые шаги» получен ✦");
    const late = stateOf("newbie", { ...FACTS.newbie, firstDay: "2026-09-01" });
    expect(R(h(MasteryScreen, { T: S, state: late, role: "core", inline: true }))).not.toContain("data-ms-first");
    // дней осталось: 1 — «остался 1 день»
    const last = stateOf("newbie", { ...FACTS.newbie, firstDay: "2026-10-02" });
    expect(R(h(MasteryScreen, { T: S, state: last, role: "core", inline: true }))).toContain("2 из 7 · остался 1 день");
  });

  it("мастера заведения: список (✦, имя, роль, «12 окт», «ты»), пусто, загрузка; без связи — только «Обновить»; сервер не обновлён — ничего", () => {
    const html = screen("mid");
    const list = between(html, "data-ms-masters", "Значки считаются");
    expect(list).toContain("Мастера заведения · 3");
    expect(count(list, /data-ms-master=""/g)).toBe(3);
    expect(list).toContain("Мария Лебедева");
    expect(list).toContain("мастер роли «Ядро»");
    expect(list).toContain("мастер роли «Бар»");
    expect(list).toContain(">12 окт<");
    expect(list).toContain(">21 сен<");
    expect(list).toMatch(/Анна Смирнова<\/span><span[^>]*>ты</);
    expect(screen("mid", { masters: { status: "ok", rows: [], prize: null, can_prize: false } })).toContain("Пока никого. Первый знак ✦ в заведении может быть твоим");
    const loading = screen("mid", { masters: { status: "loading" } });
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain("sa-skel");
    for (const s of ["offline", "error"]) {
      const off = screen("mid", { masters: { status: s } });
      expect(off).not.toContain("data-ms-masters=");
      expect(off).toContain("data-ms-masters-reload");
      expect(off).toContain(">Обновить<");
      expect(text(between(off, "data-ms-masters-reload", "</div>"))).not.toMatch(/ошибк|сервер|Supabase|связ/i);   // без технических слов
    }
    const missing = screen("mid", { masters: { status: "missing" } });
    expect(missing).not.toContain("data-ms-masters");
    expect(missing).not.toContain("Обновить");
    expect(screen("mid", { masters: { status: "error" }, onReloadMasters: undefined })).not.toContain("Обновить");
  });

  it("руководитель: «Назначить приз ›» (приза нет) или «Изменить приз» (есть)", () => {
    expect(between(screen("mid", { masters: { ...MASTERS, prize: null, can_prize: true } }), "data-ms-prize", "data-ms-step")).toContain("Назначить приз ›");
    const set = between(screen("mid", { masters: { ...MASTERS, can_prize: true } }), "data-ms-prize", "data-ms-step");
    expect(set).toContain("Изменить приз");
    expect(text(set)).toContain("Приз заведения для мастеров: Ужин на двоих в «Океане»");
    expect(screen("mid", { masters: { ...MASTERS, prize: null } })).not.toContain("data-ms-prize");   // ни приза, ни прав — строки нет
  });

  it("мастер роли: «Ты — мастер роли «Ядро» ✦», «с 12 октября», все условия выполнены, «Сертификат мастера»", () => {
    const html = screen("master", { earned: { tiers: {}, fw: true, master: { core: "2026-10-12" } }, masters: { status: "ok", rows: [], prize: null, can_prize: true } });
    const hero = between(html, "data-ms-hero", "data-ms-step");
    expect(hero).toContain("Ты — мастер роли «Ядро» ✦");
    expect(hero).toContain("с 12 октября");
    expect(hero).toContain('aria-label="Мастер роли «Ядро» ✦ — получен"');
    expect(count(hero, /— готово"/g)).toBe(4);
    expect(hero).toContain("12 из 12 разделов");
    expect(hero).toContain("лучшая: 14 из 14");
    expect(hero).toContain("data-ms-certopen");
    expect(hero).toContain(">Сертификат мастера<");
    expect(hero).not.toContain("До звания");
    expect(html).toContain("Значки · 12 из 14");
    // уже отпразднован, а условие сейчас не выполнено (роль пополнилась) — всё равно мастер
    const st = stateOf("master", { ...FACTS.master, sectionsDone: 11, roleDone: false });
    expect(st.master.ok).toBe(false);
    const kept = R(h(MasteryScreen, { T: S, state: st, role: "core", earned: { master: { core: "2025-12-30" } }, inline: true }));
    expect(kept).toContain("Ты — мастер роли «Ядро» ✦");
    expect(kept).toContain("с 30 декабря 2025");
    // роль без названия — без пустых «»
    const anon = R(h(MasteryScreen, { T: S, state: stateOf("master"), role: "x", inline: true, focus: "certificate", profile: PROFILE }));
    expect(anon).toContain("Ты — мастер роли ✦");
    expect(anon).toContain(">мастер роли ✦<");
    expect(anon).not.toContain("«»");
    const ctxAnon = []; drawMaster({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {}, closePath() {}, fill() {}, stroke() {},
      measureText: (t) => ({ width: String(t).length * 10 }), fillText: (t) => ctxAnon.push(t) }, { name: "Анна" });
    expect(ctxAnon).toContain("мастер роли ✦");
    // мастер по состоянию, ещё не отпразднован — без даты
    expect(screen("master")).toContain("Ты — мастер роли «Ядро» ✦");
    expect(screen("master")).not.toMatch(/>с \d+ [а-я]+</);
  });

  it("focus: семейство — шторка значка: ступени, «До бронзы — ещё 1 тема», «Как получить», «Показать ›» и закрытие с data-sa-back", () => {
    const html = screen("mid", { focus: "fresh" });
    const sheet = between(html, 'data-ms-sheet="fresh"', "</button></div></div>");
    expect(html).toContain('role="dialog" aria-modal="true" aria-label="Свежесть тем" data-ms-sheet="fresh"');
    expect(html).toMatch(/data-sa-back=""[^>]*aria-label="Закрыть"|aria-label="Закрыть"[^>]*data-sa-back=""/);
    expect(sheet).toContain("Значок ещё не получен");
    expect(sheet).toContain(">Свежесть тем<");
    expect(sheet).toContain("2 темы освежены");
    expect(sheet).toContain("Бронза — 3 темы");
    expect(sheet).toContain("Серебро — 15 тем");
    expect(sheet).toContain("Золото — 40 тем");
    expect(sheet).toContain("До бронзы — ещё 1 тема");
    expect(sheet).toContain("Как получить");
    expect(sheet).toContain("Когда номер темы в треке бледнеет, нажми «Освежить» — три задания, и тема снова свежая.");
    expect(html).toMatch(/data-ms-show=""[^>]*>Показать ›</);
    const gold = screen("master", { focus: "warmup" });
    expect(gold).toContain("Значок · золото");
    expect(gold).toContain("Высшая ступень ✦");
    expect(count(between(gold, 'data-ms-sheet="warmup"', "Высшая ступень"), />есть</g)).toBe(3);
    expect(screen("mid", { focus: "streak" })).toContain("Лучшая серия — 14 дней подряд");
    expect(screen("newbie", { focus: "hall" })).toContain("Ещё не начато");
    expect(screen("mid", { focus: "нет" })).not.toContain("data-ms-sheet");
    expect(screen("mid")).not.toContain("data-ms-sheet");
  });

  it("focus: «certificate» — сертификат мастера: имя, роль, заведение и дата, до 6 значков, «Поделиться картинкой / текстом», «Закрыть»", () => {
    const html = screen("master", { focus: "certificate", earned: { master: { core: "2026-10-12" } } });
    const cert = between(html, "data-ms-cert", "Закрыть</button>");
    expect(cert).toContain('role="dialog"');
    expect(cert).toContain("✦ Service Academy ✦");
    expect(cert).toContain("СЕРТИФИКАТ МАСТЕРА");
    expect(cert).toContain("настоящим подтверждается, что");
    expect(cert).toContain(">Анна Смирнова<");
    expect(cert).toContain(">мастер роли «Ядро» ✦<");
    expect(cert).toContain(">Два моря, Океан · 12 октября 2026<");
    expect(count(between(cert, 'aria-label="Лучшие значки"', "</div>"), /role="listitem"/g)).toBe(6);
    expect(cert).toContain("Роль пройдена · 5 золотых тем · серия 14 дней · 10 значков");
    expect(cert).toContain("Поделиться картинкой");
    expect(cert).toContain("Поделиться текстом");
    expect(html).toMatch(/data-sa-back=""[^>]*>Закрыть</);
    expect(screen("mid", { focus: "certificate" })).not.toContain("data-ms-cert");   // не мастер — сертификата нет
  });

  it("светлая тема «Для чтения»: текст от 13 px, метки от 11 px; тёмная — от 12 и 10 px; нет «эмодзи» семейств", () => {
    for (const fx of ["newbie", "mid", "master"]) {
      const props = { masters: { ...MASTERS, can_prize: true }, focus: fx === "master" ? "certificate" : "fresh", earned: { tiers: {}, fw: false, master: fx === "master" ? { core: "2026-10-12" } : {} } };
      const lt = screen(fx, { ...props, a11y: true, T: A });
      for (const f of fontSizes(lt)) expect([fx, f.px >= (f.mono ? 11 : 13)]).toEqual([fx, true]);
      const dk = screen(fx, props);
      for (const f of fontSizes(dk)) expect([fx, f.px >= (f.mono ? 10 : 12)]).toEqual([fx, true]);
      for (const f of FAMILIES) expect(lt.includes(f.icon), f.id).toBe(false);
    }
  });
});

describe("v40 UI: сертификат картинкой", () => {
  function fakeCtx({ spacing = true } = {}) {
    const calls = [];
    const grad = () => ({ addColorStop() {} });
    const ctx = {
      calls, font: "10px serif", fillStyle: "", strokeStyle: "", lineWidth: 1, textAlign: "left", textBaseline: "alphabetic", lineJoin: "", lineCap: "",
      createLinearGradient: grad, createRadialGradient: grad, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {}, closePath() {}, fill() {}, stroke() {},
      measureText(t) { const px = parseFloat((String(this.font).match(/([\d.]+)px/) || [0, 10])[1]); return { width: [...String(t)].length * px * 0.55 }; },
      fillText(t, x, y) { calls.push({ t: String(t), x, y, font: this.font }); },
    };
    if (spacing) ctx.letterSpacing = "0px";
    return ctx;
  }
  const BADGES = topBadges(stateOf("master")).map((f) => ({ id: f.id, title: f.title, tier: f.tier }));

  it("drawMaster: шапка, печать, имя, роль, заведение и дата, значки с подписями, итог; всё в пределах 1080×1350", () => {
    expect([MASTER_W, MASTER_H]).toEqual([1080, 1350]);
    const ctx = fakeCtx();
    drawMaster(ctx, { ...PROFILE, roleLabel: "Ядро", date: "2026-10-12", badges: BADGES });
    const t = ctx.calls.map((c) => c.t);
    for (const s of ["✦ SERVICE ACADEMY ✦", "СЕРТИФИКАТ МАСТЕРА", "настоящим подтверждается, что", "Анна Смирнова", "мастер роли «Ядро» ✦", "Два моря, Океан · 12 октября 2026", MASTER_PARTS]) expect(t, s).toContain(s);
    expect(t).toContain("Трек");
    expect(t.filter((x) => /ЗОЛОТО|СЕРЕБРО|БРОНЗА/.test(x)).length).toBe(6);
    expect(t.map((x) => x.replace(/ /g, " "))).toContain("до смены");   // «Разминка / до смены» — предлог со словом
    for (const c of ctx.calls) { expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x).toBeLessThanOrEqual(1080); expect(c.y).toBeGreaterThan(0); expect(c.y).toBeLessThan(1350); }
    expect(ctx.calls.find((c) => c.t === "Анна Смирнова").font).toMatch(/^700 88px/);
  });

  it("drawMaster: длинное имя — двумя строками (имя / фамилия), без «настоящим…»; без разрядки в ctx — по буквам", () => {
    const ctx = fakeCtx({ spacing: false });
    drawMaster(ctx, { name: "Александра-Виктория", surname: "Константинопольская", restaurant: "Два моря, Океан", roleLabel: "Сервис-менеджер", date: "2026-10-12", badges: [] });
    const t = ctx.calls.map((c) => c.t);
    expect(t).toContain("Александра-Виктория");
    expect(t).toContain("Константинопольская");
    expect(t).not.toContain("настоящим подтверждается, что");
    expect(t).toContain("мастер роли «Сервис-менеджер» ✦");
    expect(t.filter((x) => x.length === 1).join("")).toContain("СЕРТИФИКАТ МАСТЕРА");
    expect(t).toContain(MASTER_PARTS);
  });

  it("masterShareText, masterDate; без canvas — null", async () => {
    expect(masterShareText({ name: "Анна", roleLabel: "Ядро", restaurant: "Два моря, Океан" })).toBe("✦ Я — мастер роли «Ядро» в Service Academy!\nРоль пройдена, 5 золотых тем, серия 14 дней и 10 значков.\nАнна · Два моря, Океан");
    expect(masterShareText({ roleLabel: "Бар" })).toBe("✦ Я — мастер роли «Бар» в Service Academy!\nРоль пройдена, 5 золотых тем, серия 14 дней и 10 значков.");
    expect(masterShareText()).toMatch(/^✦ Я — мастер роли в Service Academy!/);
    expect(masterDate("2026-10-12")).toBe("12 октября 2026");
    expect(masterDate(new Date(2026, 0, 5))).toBe("5 января 2026");
    expect(masterDate("")).toBe("");
    expect(await masterImage({ name: "Анна" })).toBe(null);   // в node нет canvas
  });
});

describe("v40 UI: мелочи", () => {
  it("shortDay, topBadges, msTie", () => {
    expect(shortDay(new Date(2026, 9, 12, 18, 20).toISOString())).toBe("12 окт");   // время сервера — по местному дню
    expect(shortDay(new Date(2026, 9, 15, 0, 30).toISOString())).toBe("15 окт");     // за полночь — уже новый день
    expect(shortDay("2026-05-03")).toBe("3 мая");
    expect(shortDay("")).toBe("");
    const top = topBadges(stateOf("master"));
    expect(top.length).toBe(6);
    expect(top.map((f) => f.tier)).toEqual([3, 3, 2, 2, 2, 2]);
    expect(top.map((f) => f.id).slice(0, 3)).toEqual(["track", "warmup", "tests"]);
    expect(topBadges(stateOf("newbie"))).toEqual([]);
    expect(topBadges(null)).toEqual([]);
    expect(msTie("Практика у стола")).toBe("Практика у стола");
    expect(msTie("Ещё 3 разминки до серебра")).toBe("Ещё 3 разминки до серебра");
    expect(msTie("Работа над ошибками")).toBe("Работа над ошибками");
  });
});
