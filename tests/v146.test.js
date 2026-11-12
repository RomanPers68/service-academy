// v146 (Доп. 467): владелец (12.11) на разбор «чтобы человек захотел остаться» — «Давай все»: главная кнопка золотом,
// меньше колец, цвет треков и подписи (у Бара своя медь), фото урока и первая мысль крупно (руководитель меняет фото с
// телефона, этап 51), новая ступень значка — момент на весь экран.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import { TRACKS, inkOf } from "../lib/tracks";
import { ROLES, ROLE_COLOR } from "../data/roles";
import { BAR_MODULES } from "../data/modules-bar.js";
import { TracksRow } from "../ui/tracks-row";
import { LOOK_V146_CSS } from "../ui/look-v146";
import { TOOL_COLOR, toolColor } from "../ui/tokens";
import {
  normLessonPhotos, photoOf, canEditPhotos, defaultScope, scopeName, lessonLead, lessonPhotoErr, lessonPhotoId, LP_LIMITS,
} from "../lib/lesson-photo";
import { LessonPhotoSheet } from "../ui/lesson-photo";
import { BadgeToast, momentDue, MOMENT_GAP_MS, MOMENT_KEY, MOMENT_AFTER_MS } from "../ui/mastery-card";
import { masteryState } from "../lib/mastery";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const lum = (hex) => { const v = hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

describe("v146: метка сборки и журнал", () => {
  it("«сборка v146» в «Меню»; CHANGES — Дополнение 467 со словами владельца", () => {
    expect([...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => m[1])).toEqual(["146"]);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 467 — /);
    expect(c).toContain("Давай все");
    expect(c).toContain("персонала на фоне ресторана");
  });
});

describe("v146: у Бара свой цвет; подписей под кружками треков нет (Доп. 469)", () => {
  it("Бар — медь, не золото Ядра; один цвет в ролях, треках и уроках бара; тёмный вариант — контраст 4,5", () => {
    const bar = TRACKS.find((t) => t.id === "bar"), core = TRACKS.find((t) => t.id === "core");
    expect(bar.color).toBe("#D2875A");
    expect(bar.color).not.toBe(core.color);
    expect(ROLE_COLOR.bar).toBe(bar.color);
    expect(ROLES.find((r) => r.id === "bar").dark).toBe("#3a2416");
    expect(BAR_MODULES.length).toBeGreaterThanOrEqual(9);
    for (const m of BAR_MODULES) expect(m.color, m.id).toBe(bar.color);
    expect(inkOf(bar.color, true)).toBe("#93500F");
    expect(bar.ink).toBe("#93500F");
    for (const bg of ["#F7F0E0", "#FBF5E8", "#EFE3C8"]) expect(cr("#93500F", bg)).toBeGreaterThanOrEqual(4.5);
    for (const bg of ["#1A1409", "#211A10", "#2A2113"]) expect(cr(bar.color, bg)).toBeGreaterThanOrEqual(4.5);
    // цвета всех треков разные
    expect(new Set(TRACKS.map((t) => t.color)).size).toBe(TRACKS.length);
    expect(rd("ui/guestbook.jsx")).not.toContain('ROLE_SVG.bar("#C8A96E"');
  });
  // Доп. 469 (12.11), владелец на снимке ряда: «Меня смущают подписи ролей. Либо как будто лишние, либо нужно что-то
  // другое придумать». Подписи (Доп. 467) сняты: название — в панели по тапу, в «подробнее ›» и у кружка в title/aria-label.
  it("ряд: подписей под кружками нет, отступа под них нет; имя трека — в title и aria-label; цвет трека — переменными --tc", () => {
    const T = { modSub: { color: "#999" } };
    const html = R(h(TracksRow, { T, a11y: false, role: "seasonal", unlocked: new Set(["spg", "seasonal", "bar"]), progressOf: () => 8, onSelect: () => {}, frame: "#555" }));
    expect(html).not.toContain("data-track-cap");
    expect(html).toContain('data-tracks-nodes="" style="display:flex;align-items:center;justify-content:space-between"');
    for (const l of ["Хостес", "Новичок", "Ядро", "Менеджер", "Сервис-менеджер", "Бар"]) expect(html).toContain('title="' + l + '"');
    expect(html).toContain('aria-label="Трек «Новичок», твой"');
    expect(html).toMatch(/data-track-chip="seasonal"[^>]*data-track-cur=""/);
    expect(html).toContain("--tc:#D2875A;--tc-a:#D2875A2E;--tc-r:#D2875AA6");
    expect(html).toMatch(/data-track-chip="core" data-track-locked=""[^>]*style="(?![^"]*--tc:)/);
    expect(rd("ui/tracks-row.jsx")).not.toMatch(/trackCaption|captionSize|capH/);
  });
});

describe("v146: «Линза» — главная кнопка золотом, меньше колец (ui/look-v146.js)", () => {
  const rules = LOOK_V146_CSS.split("\n").filter((l) => l.includes("{") && !/^\s*\/\*/.test(l) && !/^\s+/.test(l));
  it("отдельный файл после правил home-look.jsx; все правила — под html.sa-lens; без ${…}", () => {
    expect(rules.length).toBeGreaterThanOrEqual(15);
    for (const r of rules) expect(r, r).toMatch(/^html\.sa-lens[ .:[]/);
    expect(LOOK_V146_CSS).not.toContain("${");
    const L = rd("ui/home-look.jsx");
    expect(L).toContain('import { ensureLookV146Css } from "./look-v146";');
    expect(L).toMatch(/ensureLookCss\(\) \{[\s\S]*?ensureLookV146Css\(\);/);
    // разделы home-look.jsx не тронуты: последний — по-прежнему v122
    expect(L.indexOf("/* ── v", L.indexOf("/* ── v122") + 5)).toBe(-1);
  });
  it("главная кнопка и .tb-main — золотая заливка, тёмная надпись, без кольца; значки внутри — цветом надписи", () => {
    expect(LOOK_V146_CSS).toContain('html.sa-lens [data-lens-btn="main"]:not(#sa-v146),html.sa-lens .tb-table .tb-main:not(:disabled):not(#sa-v146),');
    expect(LOOK_V146_CSS).toContain("color:#24180A!important;border-color:transparent!important;");
    expect(LOOK_V146_CSS).toContain("background:linear-gradient(172deg,#F1DBA4 0%,#DDBE7F 46%,#BC9A5E 100%)!important;");
    expect(LOOK_V146_CSS).toContain('html.sa-lens [data-lens-btn="main"]:not(#sa-v146)::after,html.sa-lens .tb-main:not(#sa-v146)::after{display:none!important}');
    expect(LOOK_V146_CSS).toContain('html.sa-lens [data-lens-btn="main"]:not(#sa-v146) *{color:inherit!important}');
    for (const bg of ["#F1DBA4", "#DDBE7F", "#BC9A5E", "#EFD69C", "#D7B470", "#B48F50"]) expect(cr("#24180A", bg), bg).toBeGreaterThanOrEqual(5.5);
  });
  it("кольцо: нет у простых значков; есть у медальонов, треков, кнопки AI, чата и «Слушать»", () => {
    expect(LOOK_V146_CSS).toContain("html.sa-lens:not(#sa-v146),html.sa-lens .sa-look:not(#sa-v146),html.sa-lens.sa-light .sa-look:not(#sa-v146){--lk-ring:transparent}");
    for (const s of [".de-medal", "[data-tracks-row]", "[data-tab-ai]", "[data-chat-dock]", ".rd-ctl .play"]) {
      expect(LOOK_V146_CSS).toContain("html.sa-lens " + s + ":not(#sa-v146)");
      expect(LOOK_V146_CSS).toContain("html.sa-lens.sa-light " + s + ":not(#sa-v146)");
    }
    expect(LOOK_V146_CSS).toContain('html.sa-lens [data-lens="glyph"]:not(#sa-v146)::after{border-color:transparent!important}');
    // инструменты главной: внешнего кольца нет (Доп. 468 вернул им стекло — см. ниже)
    expect(LOOK_V146_CSS).toContain("html.sa-lens .sa-look-lens [data-tool-disc]:not(#sa-v146)::after{display:none!important}");
  });
  it("«Начать» на главной — золотой корешок; треки — цветом трека", () => {
    expect(LOOK_V146_CSS).toContain("html.sa-lens .sa-look-lens [data-now-stub]:not(#sa-v146){position:relative;width:84px!important;");
    expect(LOOK_V146_CSS).toContain("html.sa-lens .sa-look-lens [data-now-stub] [data-now-cta]:not(#sa-v146){color:#1A1008!important;");
    expect(LOOK_V146_CSS).toContain("background:var(--tc-a,var(--lk-glass))!important;");
    expect(LOOK_V146_CSS).toContain("svg circle+circle{stroke:var(--tc,var(--lk-gold))}");
  });
});

describe("v146: фото урока — данные (lib/lesson-photo.js)", () => {
  const raw = { ok: true, restaurant: "Океан", can: { net: false, venue: true }, items: [
    { lesson: "s0-1", scope: "", ver: "aaaaaaaaaaaa", w: 900, h: 600, by: "Роман" },
    { lesson: "s0-1", scope: "Океан", ver: "bbbbbbbbbbbb", w: 1280, h: 853, by: "Мария Ким" },
    { lesson: "c4-3", scope: "", ver: "cccccccccccc" },
    { lesson: "x-1", scope: "Порт", ver: "dddddddddddd" },
    { lesson: "bad id", scope: "", ver: "eeeeeeeeeeee" },
  ] };
  it("своё заведение важнее сети; чужие заведения и битые номера — мимо", () => {
    const n = normLessonPhotos(raw);
    expect(n.restaurant).toBe("Океан");
    expect(n.can).toEqual({ net: false, venue: true });
    expect(Object.keys(n.map).sort()).toEqual(["c4-3", "s0-1"]);
    expect(photoOf(n, "s0-1")).toMatchObject({ scope: "Океан", ver: "bbbbbbbbbbbb", w: 1280, by: "Мария Ким" });
    expect(n.map["s0-1"].net.ver).toBe("aaaaaaaaaaaa");
    expect(photoOf(n, "c4-3").scope).toBe("");
    expect(photoOf(n, "нет")).toBe(null);
    expect(normLessonPhotos({ ok: false })).toBe(null);
    expect(normLessonPhotos({ ok: true, restaurant: null, can: { net: true, venue: true }, items: [] }).can).toEqual({ net: true, venue: false });
  });
  it("кто ставит и куда по умолчанию", () => {
    const n = normLessonPhotos(raw);
    expect(canEditPhotos(n)).toBe(true);
    expect(canEditPhotos(normLessonPhotos({ ok: true, restaurant: "Океан", items: [] }))).toBe(false);
    expect(defaultScope(n, "s0-1")).toBe("Океан");
    expect(defaultScope(n, "c4-3")).toBe("Океан");   // сети нельзя — своё заведение
    const boss = normLessonPhotos({ ...raw, can: { net: true, venue: true } });
    expect(defaultScope(boss, "c4-3")).toBe("");      // правим то, что стоит: у c4-3 — фото сети
    expect(defaultScope(boss, "s0-1")).toBe("Океан");
    expect(defaultScope(boss, "новый")).toBe("");
    expect(scopeName("")).toBe("вся сеть");
    expect(scopeName("Океан")).toBe("только «Океан»");
    expect(lessonPhotoId("cms-l-cn-idea")).toBe("cms-l-cn-idea");
    expect(lessonPhotoId("урок 1")).toBe(null);
    expect(LP_LIMITS).toMatchObject({ full: 640000, thumb: 110000 });
  });
  it("ошибки — понятными словами; владельцу — какой файл запустить", () => {
    expect(lessonPhotoErr("missing", true)).toContain("supabase-stage51-lesson-photos.sql");
    expect(lessonPhotoErr("missing", false)).toBe("Фото уроков заработают, когда владелец обновит сервер (этап 51).");
    expect(lessonPhotoErr("forbidden")).toBe("Ставить фото к урокам могут руководители.");
    expect(lessonPhotoErr("что-то")).toContain("нет связи с сервером");
  });
  it("первая мысль урока: первый обычный абзац; у длинного — первое предложение; заголовок, список или фраза гостю первыми — без неё", () => {
    const A = "Сеть «Два моря» выросла из одного зала на набережной. Идея с первого дня одна: свежий улов и сервис, как у друзей дома.\n\n**Что нас отличает**\n• Рыба";
    expect(lessonLead(A)).toEqual({ line: A.split("\n")[0], lead: A.split("\n")[0], rest: "" });
    const long = "Добро пожаловать. Ты сделал выбор — работать в сфере, где каждый день общаешься с людьми. Это непростая, но одна из самых живых профессий, и в ней многому придётся научиться в первые недели, но команда рядом и всегда подскажет.";
    expect(lessonLead("👋👋👋\n" + long)).toEqual({ line: long, lead: "Добро пожаловать. Ты сделал выбор — работать в сфере, где каждый день общаешься с людьми.", rest: "Это непростая, но одна из самых живых профессий, и в ней многому придётся научиться в первые недели, но команда рядом и всегда подскажет." });
    expect(lessonLead("[mm:wave]\n" + A)).toMatchObject({ rest: "" });
    expect(lessonLead("**Заголовок**\n" + A)).toBe(null);
    expect(lessonLead("• Пункт списка, который идёт первым и довольно длинный\n" + A)).toBe(null);
    expect(lessonLead("«Добрый вечер! Меня зовут Анна, я ваш официант сегодня»")).toBe(null);
    expect(lessonLead("✅ Делай так: улыбайся гостю и смотри в глаза, когда говоришь")).toBe(null);
    expect(lessonLead("Коротко.")).toBe(null);
    expect(lessonLead("")).toBe(null);
    expect(lessonLead("a\nb\nc\nd\n" + A)).toBe(null);   // дальше четвёртой строки не ищем
  });
});

describe("v146: фото урока — экран и лист", () => {
  const S = rd("ui/screens-learning.jsx");
  it("урок: обложка первой в карточке (на первой карточке или в ленте), первая мысль — шрифтом заголовков, выделенное — золотом", () => {
    expect(S).toContain('import { LessonCover } from "./lesson-photo";');
    expect(S).toContain('import { lessonLead, lessonPhotoId } from "../lib/lesson-photo";');
    expect(S).toContain("? <LessonCover lessonId={lesson.id} lessonTitle={lesson.title} profile={profile} a11y={!!T.a11y} color={color} /> : null}");
    expect(S).toContain("{(!cardMode || cardIdx === 0) && lessonPhotoId(lesson.id)");
    expect(S).toContain('<div data-lesson-first="" style={{ ...T.para, fontFamily: ACCENT_SERIF, fontWeight: 700, fontSize: T.a11y ? 21.5 : 19.5, lineHeight: 1.36,');
    expect(S).toContain("})({ v: false }))}");
  });
  it("лист: руководящему составу — «Вся сеть» и своё заведение; фото в другом месте — что заменит; «Выбрать фото» — главная кнопка", () => {
    const list = normLessonPhotos({ ok: true, restaurant: "Океан", can: { net: true, venue: true }, items: [{ lesson: "s0-1", scope: "", ver: "aaaaaaaaaaaa", by: "Роман" }] });
    const html = R(h(LessonPhotoSheet, { lessonId: "s0-1", lessonTitle: "Первый день", profile: { name: "Мария", position: "senior" }, a11y: false, list, onClose: () => {} }));
    expect(html).toContain('data-lp-scope="net"');
    expect(html).toContain(">Вся сеть<");
    expect(html).toContain(">«Океан»<");
    expect(html).toContain("Сейчас:");   // правим фото сети: превью и «Убрать»
    expect(html).toContain("Убрать фото");
    expect(html).toContain('data-lp-pick="" data-lens-btn="main"');
    expect(html).toContain("Сменить фото");
    const venue = normLessonPhotos({ ok: true, restaurant: "Океан", can: { net: false, venue: true }, items: [{ lesson: "s0-1", scope: "", ver: "aaaaaaaaaaaa", by: "Роман" }] });
    const v = R(h(LessonPhotoSheet, { lessonId: "s0-1", lessonTitle: "", profile: { name: "Пётр", position: "manager" }, a11y: true, list: venue, onClose: () => {} }));
    expect(v).not.toContain("data-lp-scope");
    expect(v).toContain("Сейчас у урока фото всей сети (поставил(а) Роман). Новое заменит его для «Океан».");
    expect(v).toContain("Выбрать фото");
    expect(v).not.toContain("Убрать фото");
  });
  it("нет этапа 51 — лист говорит, что делать, без кнопок", () => {
    const html = R(h(LessonPhotoSheet, { lessonId: "s0-1", lessonTitle: "", profile: { name: "Роман", is_admin: true }, a11y: false, list: "missing", onClose: () => {} }));
    expect(html).toContain("supabase-stage51-lesson-photos.sql");
    expect(html).not.toContain("data-lp-pick");
  });
});

describe("v146: этап 51 и сервер демо", () => {
  it("SQL: таблица, четыре функции VOLATILE с проверкой входа, права как у «О нас», служебная закрыта, итог", () => {
    const Q = rd("supabase/supabase-stage51-lesson-photos.sql");
    for (const s of ["Этап 51 (v146, Доп. 467)", "create table if not exists sa_lesson_photos (", "primary key (scope, lesson)",
      "alter table sa_lesson_photos enable row level security;", "create or replace function _sa_lp_can(c jsonb, p_scope text)",
      "create or replace function lesson_photos(p_token text)", "create or replace function lesson_photo(p_token text, p_lesson text, p_full boolean default false, p_scope text default null)",
      "create or replace function lesson_photo_set(p_token text, p_lesson text, p_scope text, p_full text, p_thumb text,",
      "create or replace function lesson_photo_del(p_token text, p_lesson text, p_scope text)",
      "order by (x.scope = '') limit 1;", "on conflict (scope, lesson) do update", "v := left(md5(p_full), 12);",
      "revoke all on function _sa_lp_can(jsonb, text) from public, anon, authenticated;", "notify pgrst, 'reload schema';",
      "' функции из 4'", "Можно запускать повторно."]) expect(Q, s).toContain(s);
    expect((Q.match(/language plpgsql volatile security definer set search_path to public/g) || []).length).toBe(4);
    expect((Q.match(/c := _sa_caller\(p_token\);/g) || []).length).toBe(4);
    const RM = rd("supabase/README.md");
    expect(RM).toContain("| 60 | `supabase-stage51-lesson-photos.sql` | **Фото урока** (v146)");
    expect(RM).toContain("### Этап 51 (v146) — фото урока");
  });
  it("сервер демо — как этап 51: права, своё заведение важнее сети, замена, снятие; без этапа — функции нет", () => {
    const R0 = "Океан";
    const PEOPLE = [
      { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
      { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
      { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
      { id: "e-ivan", name: "Иван", surname: "П", restaurant: "Порт", position: "waiter", is_admin: false },
    ];
    const tok = { tr: "u-roman", tm: "u-maria", ta: "e-anna", ti: "e-ivan" };
    const F = "QUJD".repeat(40), T = "REVG".repeat(10);
    const mk = (x = {}) => makeServer({ today: "2026-11-12", rest: R0, people: PEOPLE, tok, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false,
      lessonPhotos: { "s0-1|": { full: F, thumb: T, w: 900, h: 600, by: "Роман" } }, ...x });
    const s = mk();
    expect(s.rpc("lesson_photos", { p_token: "ta" })).toMatchObject({ ok: true, restaurant: R0, can: { net: false, venue: false } });
    expect(s.rpc("lesson_photos", { p_token: "tm" }).can).toEqual({ net: false, venue: true });
    expect(s.rpc("lesson_photos", { p_token: "tr" }).can).toEqual({ net: true, venue: true });
    expect(s.rpc("lesson_photo_set", { p_token: "ta", p_lesson: "s0-1", p_scope: R0, p_full: F, p_thumb: T }).error).toBe("forbidden");
    expect(s.rpc("lesson_photo_set", { p_token: "tm", p_lesson: "s0-1", p_scope: "", p_full: F, p_thumb: T }).error).toBe("forbidden");
    expect(s.rpc("lesson_photo_set", { p_token: "tm", p_lesson: "s0-1", p_scope: R0, p_full: "!" + F, p_thumb: T }).error).toBe("bad_photo");
    expect(s.rpc("lesson_photo_set", { p_token: "tm", p_lesson: "урок 1", p_scope: R0, p_full: F, p_thumb: T }).error).toBe("bad_request");
    const set = s.rpc("lesson_photo_set", { p_token: "tm", p_lesson: "s0-1", p_scope: R0, p_full: "R0hJ".repeat(40), p_thumb: T, p_w: 1280, p_h: 853 });
    expect(set).toMatchObject({ ok: true, scope: R0 });
    expect(set.ver).toMatch(/^[0-9a-f]{12}$/);
    expect(s.rpc("lesson_photo", { p_token: "ta", p_lesson: "s0-1" })).toMatchObject({ ok: true, scope: R0, ver: set.ver, data: T, w: 1280 });
    expect(s.rpc("lesson_photo", { p_token: "ta", p_lesson: "s0-1", p_full: true }).data).toBe("R0hJ".repeat(40));
    expect(s.rpc("lesson_photo", { p_token: "ti", p_lesson: "s0-1" }).scope).toBe("");
    expect(s.rpc("lesson_photo", { p_token: "ta", p_lesson: "s0-1", p_scope: "" }).data).toBe(T);
    expect(s.rpc("lesson_photo", { p_token: "ta", p_lesson: "s0-1", p_scope: "Порт" }).error).toBe("not_found");
    expect(s.rpc("lesson_photos", { p_token: "ti" }).items.map((x) => x.lesson + "@" + x.scope)).toEqual(["s0-1@"]);
    expect(s.rpc("lesson_photos", { p_token: "ta" }).items.map((x) => x.lesson + "@" + x.scope)).toEqual(["s0-1@", "s0-1@" + R0]);
    expect(s.rpc("lesson_photo_del", { p_token: "tm", p_lesson: "s0-1", p_scope: R0 })).toEqual({ ok: true, removed: 1 });
    expect(s.rpc("lesson_photo", { p_token: "ta", p_lesson: "s0-1" }).scope).toBe("");
    expect(s.rpc("lesson_photo_del", { p_token: "tr", p_lesson: "s0-1", p_scope: "" })).toEqual({ ok: true, removed: 1 });
    expect(s.rpc("lesson_photo", { p_token: "ta", p_lesson: "s0-1" }).error).toBe("not_found");
    expect(s.S.lp["s0-1|"]).toBe(null);   // убранный снимок примера помнится в состоянии, сам снимок там не хранится
    expect(s.rpc("lesson_photos", { p_token: "нет" }).error).toBe("auth");
    expect(mk({ noStage51: true }).rpc("lesson_photos", { p_token: "ta" }).code).toBe("PGRST202");
  });
});

describe("v146: новый значок — момент на весь экран", () => {
  const st = masteryState({}, "core", { now: new Date("2026-11-12T10:00:00Z") });
  const item = { kind: "tier", id: "fresh", title: "Свежесть тем", tier: 2 };
  it("без moment — прежняя плашка; moment: true — момент: диалог, медаль, ступень, «Путь мастера ›» и «Позже»", () => {
    expect(R(h(BadgeToast, { a11y: false, item, state: st, onOpen: () => {}, onClose: () => {}, inline: true }))).toContain('role="status"');
    const html = R(h(BadgeToast, { a11y: false, item, state: st, onOpen: () => {}, onClose: () => {}, inline: true, moment: true }));
    expect(html).toContain('class="ms-moment" data-ms-toast="" data-ms-moment="2"');
    expect(html).toContain('role="dialog" aria-modal="true" aria-label="Новый значок: Свежесть тем"');
    expect(html).toContain("Новый значок · серебро");
    expect(html).toContain('class="ms-mint"');
    expect(html).toContain('class="ms-shine"');
    expect(html).toContain('data-lens-btn="main"');
    expect(html).toContain("Путь мастера ›");
    expect(html).toMatch(/data-sa-back=""[^>]*>Позже</);
    const first = R(h(BadgeToast, { a11y: true, item: { kind: "firstWeek" }, state: st, onOpen: () => {}, onClose: () => {}, inline: true, moment: true }));
    expect(first).toContain('data-ms-moment="first"');
    expect(first).toContain(">Первые шаги<");
    // «Мастер роли» — как был
    expect(R(h(BadgeToast, { a11y: false, item: { kind: "master", role: "seasonal" }, onOpen: () => {}, onClose: () => {}, inline: true, moment: true }))).toContain('class="ms-modal"');
  });
  it("момент — новой ступени и «Первым шагам», не чаще раза в 10 минут", () => {
    const now = Date.parse("2026-11-12T10:00:00Z");
    expect(MOMENT_GAP_MS).toBe(600000);
    expect(MOMENT_KEY).toBe("sa_ms_moment_at");
    expect(momentDue(item, now, 0)).toBe(true);
    expect(momentDue({ kind: "firstWeek" }, now, 0)).toBe(true);
    expect(momentDue({ kind: "master", role: "core" }, now, 0)).toBe(false);
    expect(momentDue(item, now, now - 60000)).toBe(false);
    expect(momentDue(item, now, now - MOMENT_GAP_MS)).toBe(true);
    expect(momentDue(item, now, now + 3600e3)).toBe(true);   // часы телефона ушли назад — не ждём час
    expect(momentDue(null, now, 0)).toBe(false);
  });
  it("App.jsx: момент — только в первые 10 минут после занятия (при входе — плашка); стили момента и «меньше движения»", () => {
    const A = rd("App.jsx");
    expect(A).toContain('{mToast ? <BadgeToast a11y={a11y} item={mToast} state={mState} moment={Date.now() - lastActRef.current < MOMENT_AFTER_MS ? "auto" : null}');
    expect(A).toMatch(/const logActivity = useCallback\(\(kind, n = 1\) => \{\n    lastActRef\.current = Date\.now\(\);/);
    expect(MOMENT_AFTER_MS).toBe(600000);
    const M = rd("ui/mastery-card.jsx");
    for (const s of [".ms-moment{position:fixed;inset:0;z-index:9700;", "@keyframes msMint{", "@keyframes msShineGo{", "@keyframes msWave{",
      "@media (prefers-reduced-motion: reduce){.ms-moment,.ms-moment-card,.ms-mint{animation:none}.ms-shine::after,.ms-wave{display:none}}",
      'sfx("ok"); vibrate("success");']) expect(M, s).toContain(s);
  });
});

// Доп. 468 (12.11), владелец о ряде инструментов главной: «Может иконки в справочнике немного выделим? А то они какие-то
// невзрачные» — в Доп. 467 у них сняли стекло и кольцо, остались голые значки. Пробовали кружки своего цвета; владелец:
// «Может их сделаем линзами, как были, только без второго кольца». Линзы — прежние (ui/home-look.jsx), без кольца снаружи.
describe("v146 (Доп. 468): инструменты главной — линзы, как были, с одним кольцом", () => {
  const RS = rd("ui/screens-roleselect.jsx"), LOOK = rd("ui/home-look.jsx");
  const S = "html.sa-lens .sa-look-lens [data-tool-disc]:not(#sa-v146)";
  it("внешнее кольцо (::after) скрыто, стекло (::before) — есть и во весь кружок", () => {
    expect(LOOK_V146_CSS).toContain(S + "::after{display:none!important}");
    expect(LOOK_V146_CSS).toContain(S + "::before{inset:0}");
    expect(LOOK_V146_CSS).not.toMatch(/\[data-tool-disc\][^{]*::before[^{]*\{[^}]*display:none/);   // стекло не прячем
  });
  it("линза — прежняя: стекло, ободок, свет сверху и отсвет цвета инструмента снизу (ui/home-look.jsx не тронут)", () => {
    expect(LOOK).toContain('.sa-look-lens [data-tool-disc]::before{content:"";position:absolute;inset:2.5px;border-radius:50%;background:var(--lk-glass);pointer-events:none;');
    expect(LOOK).toContain("box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 12px var(--lk-glow),inset 0 1.5px 0 var(--lk-hl),inset 0 -9px 12px -7px var(--tint,transparent)}");
    expect(RS).toContain('"--tint": c + "55",');
  });
  it("цвета и значки — как были: свой цвет у Справочника, Меню, Глоссария; кружков своего цвета больше нет", () => {
    expect(Object.keys(TOOL_COLOR)).toEqual(["sp", "menu", "gl"]);
    expect(toolColor("cl", false)).toBe(toolColor("sp", false));
    expect(RS).not.toContain('"--tl"');
    expect(LOOK_V146_CSS).not.toContain("--tl");
    expect(LOOK_V146_CSS).not.toMatch(/\[data-tool-disc\][^{]*>svg/);   // значки — прежним золотом, прежней линией
  });
});
